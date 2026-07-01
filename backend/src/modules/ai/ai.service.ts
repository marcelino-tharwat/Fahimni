import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { geminiClient } from "../../shared/services/geminiClient.js";
import { supabase } from "../../config/supabase.js";
import { PDFParse } from "pdf-parse";
import { AppError } from "../../shared/utils/AppError.js";
import type { IndexingStatus, TextChunk, SimilarChunk } from "./ai.types.js";

const BATCH_SIZE = 5;
/** Must match `content_chunks.embedding vector(3072)` and Gemini text-embedding-004 output. */
export const EXPECTED_EMBEDDING_DIMENSION = 3072;

export class AiService {
  private indexingStatus = new Map<string, IndexingStatus>();

  chunkText(text: string): TextChunk[] {
    const raw = text.split(/\n\n+/);
    const merged: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const trimmed = raw[i]!.trim();
      if (!trimmed) continue;

      if (trimmed.length < 100 && merged.length > 0) {
        merged[merged.length - 1] += "\n\n" + trimmed;
      } else {
        merged.push(trimmed);
      }
    }

    const chunks: TextChunk[] = [];
    let charOffset = 0;

    for (let i = 0; i < merged.length; i++) {
      const content = merged[i]!;
      const charStart = text.indexOf(content, charOffset);
      const charEnd = charStart + content.length;
      chunks.push({ content, index: i, charStart, charEnd });
      charOffset = charEnd;
    }

    return chunks;
  }

  async embedAndStore(
    chunks: TextChunk[],
    lessonId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      const embeddings = await Promise.all(
        batch.map((chunk) => geminiClient.embedContent(chunk.content)),
      );

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]!;
        const vector = embeddings[j]!;
        if (vector.length !== EXPECTED_EMBEDDING_DIMENSION) {
          throw new AppError(
            `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${vector.length}`,
            500,
          );
        }
        const vectorStr = `[${vector.join(",")}]`;

        await prisma.$executeRaw`
          INSERT INTO content_chunks (id, content, embedding, "lessonId", metadata, "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, ${chunk.content}, ${vectorStr}::vector, ${lessonId}, ${JSON.stringify(metadata)}::jsonb, NOW(), NOW())
        `;
      }

      logger.info(
        `[AiService] Stored ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks for lesson ${lessonId}`,
      );
    }
  }

  async indexLesson(
    lessonId: string,
    pdfText: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.indexingStatus.set(lessonId, "indexing");

    try {
      const existing = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true },
      });

      if (!existing) {
        this.indexingStatus.set(lessonId, "failed");
        throw new AppError("Lesson not found", 404);
      }

      await prisma.$executeRaw`DELETE FROM content_chunks WHERE "lessonId" = ${lessonId}`;

      const chunks = this.chunkText(pdfText);
      logger.info("material_chunking_completed", {
        lessonId,
        chunkCount: chunks.length,
      });

      if (chunks.length === 0) {
        this.indexingStatus.set(lessonId, "failed");
        logger.info("material_processing_failed", {
          lessonId,
          safeErrorCode: "EMPTY_TEXT",
          chunkCount: 0,
        });
        throw new AppError("No indexable text content for lesson", 400);
      }

      await this.embedAndStore(chunks, lessonId, metadata ?? {});
      logger.info("material_embedding_completed", {
        lessonId,
        chunkCount: chunks.length,
      });

      this.indexingStatus.set(lessonId, "ready");
      logger.info("material_processing_completed", {
        lessonId,
        chunkCount: chunks.length,
        outcome: "READY",
      });
    } catch (error) {
      this.indexingStatus.set(lessonId, "failed");
      const safeErrorCode =
        error instanceof AppError && error.statusCode === 400
          ? "EMPTY_TEXT"
          : "UNKNOWN_PROCESSING_ERROR";
      logger.info("material_processing_failed", {
        lessonId,
        safeErrorCode,
      });
      throw error;
    }
  }

  /**
   * Re-indexes a lesson by downloading all its uploaded PDF files from storage,
   * extracting their text, and running the full chunking + embedding pipeline.
   * This gives teachers a one-click "re-index" without manually providing text.
   * Throws if no PDF files exist or no text can be extracted.
   */
  async reindexLesson(lessonId: string): Promise<void> {
    const materials = await prisma.lessonMaterial.findMany({
      where: { lessonId, deletedAt: null },
      select: { filePath: true, displayName: true },
    });

    if (materials.length === 0) {
      throw new AppError("لم يتم العثور على ملفات مرفوعة لهذا الدرس.", 400);
    }

    const bucket = process.env.SUPABASE_BUCKET_NAME!;
    const texts: string[] = [];

    for (const material of materials) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(material.filePath);

        if (error || !data) {
          logger.warn(`[AiService] Failed to download ${material.filePath}: ${error?.message}`);
          continue;
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const textResult = await parser.getText();
        const text = textResult.text.trim();

        if (text.length > 0) {
          texts.push(text);
          logger.info(`[AiService] Extracted ${text.length} chars from ${material.displayName}`);
        }
      } catch (err) {
        logger.warn(`[AiService] PDF extraction failed for ${material.filePath}: ${err}`);
      }
    }

    if (texts.length === 0) {
      throw new AppError("تعذّر استخراج نص من الملفات المرفوعة.", 400);
    }

    const mergedText = texts.join("\n\n");
    await this.indexLesson(lessonId, mergedText, {
      reindexedFrom: "storage",
      fileCount: materials.length,
      extractedCount: texts.length,
    });
  }

  async getStatus(
    lessonId: string,
  ): Promise<{ status: IndexingStatus; chunkCount: number }> {
    const memStatus = this.indexingStatus.get(lessonId);

    if (memStatus && memStatus !== "ready" && memStatus !== "failed") {
      return { status: memStatus, chunkCount: 0 };
    }

    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint as count FROM content_chunks WHERE "lessonId" = ${lessonId}`;
    const count = Number(result[0]!.count);

    if (count > 0) {
      return { status: "ready", chunkCount: count };
    }

    if (memStatus === "failed") {
      return { status: "failed", chunkCount: 0 };
    }

    return { status: "pending", chunkCount: 0 };
  }

  async similaritySearch(
    query: string,
    lessonId?: string,
    k = 5,
  ): Promise<SimilarChunk[]> {
    const vector = await geminiClient.embedContent(query);
    const vectorStr = `[${vector.join(",")}]`;

    const whereClause = lessonId
      ? `WHERE "lessonId" = $2`
      : ``;

    const params: unknown[] = [vectorStr, k];
    if (lessonId) {
      params.push(lessonId);
    }

    const rawQuery = `
      SELECT id, content, "lessonId", metadata,
             1 - (embedding <=> $1::vector) as score
      FROM content_chunks
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        lessonId: string;
        metadata: Record<string, unknown>;
        score: number;
      }>
    >(rawQuery, ...params);

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      lessonId: row.lessonId,
      score: row.score,
      metadata: row.metadata,
    }));
  }

  /**
   * Cosine top-K similarity search scoped to a set of lessons. Reuses the same
   * pgvector index and embedding pipeline as {@link similaritySearch}; the only
   * difference is that results are constrained to the supplied lesson IDs so a
   * teacher can never retrieve another teacher's chunks. Returns an empty array
   * when no lesson IDs are supplied.
   */
  async similaritySearchInLessons(
    query: string,
    lessonIds: string[],
    k = 8,
  ): Promise<SimilarChunk[]> {
    if (lessonIds.length === 0) {
      return [];
    }

    const vector = await geminiClient.embedContent(query);
    const vectorStr = `[${vector.join(",")}]`;

    const rawQuery = `
      SELECT id, content, "lessonId", metadata,
             1 - (embedding <=> $1::vector) as score
      FROM content_chunks
      WHERE "lessonId" = ANY($2::text[])
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        lessonId: string;
        metadata: Record<string, unknown>;
        score: number;
      }>
    >(rawQuery, vectorStr, lessonIds, k);

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      lessonId: row.lessonId,
      score: row.score,
      metadata: row.metadata,
    }));
  }

  /**
   * Counts indexed content chunks belonging to the supplied lessons. Used as a
   * RAG precondition check before AI generation so callers can fail fast when
   * the selected content has not been indexed yet.
   */
  async countChunksInLessons(lessonIds: string[]): Promise<number> {
    if (lessonIds.length === 0) {
      return 0;
    }

    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM content_chunks
      WHERE "lessonId" = ANY(${lessonIds}::text[])
    `;

    return Number(result[0]!.count);
  }
}

export const aiService = new AiService();
