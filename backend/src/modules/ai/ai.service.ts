import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { geminiClient } from "../../shared/services/geminiClient.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { IndexingStatus, TextChunk, SimilarChunk } from "./ai.types.js";

const BATCH_SIZE = 5;

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

      if (chunks.length === 0) {
        this.indexingStatus.set(lessonId, "ready");
        logger.warn(`[AiService] No chunks extracted for lesson ${lessonId}`);
        return;
      }

      await this.embedAndStore(chunks, lessonId, metadata ?? {});

      this.indexingStatus.set(lessonId, "ready");
      logger.info(
        `[AiService] Indexed ${chunks.length} chunks for lesson ${lessonId}`,
      );
    } catch (error) {
      this.indexingStatus.set(lessonId, "failed");
      logger.error(
        `[AiService] Indexing failed for lesson ${lessonId}`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
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
}

export const aiService = new AiService();
