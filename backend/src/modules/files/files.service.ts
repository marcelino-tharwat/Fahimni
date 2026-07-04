import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../config/supabase.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { PDFParse } from "pdf-parse";
import { aiService } from "../ai/ai.service.js";
import type { IndexingStatus } from "../ai/ai.types.js";

export class FilesService {
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .upload(key, buffer, { contentType });

    if (error) {
      throw new AppError(`Failed to upload file: ${error.message}`, 500);
    }

    return key;
  }

  async getSignedUrl(filePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) {
      throw new AppError(`Failed to generate signed URL: ${error.message}`, 500);
    }

    return data.signedUrl;
  }

  async downloadFileBuffer(
    filePath: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .download(filePath);

    if (error || !data) {
      throw new AppError("Failed to retrieve file", 404);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType =
      typeof data.type === "string" && data.type.length > 0
        ? data.type
        : "application/pdf";

    return { buffer, contentType };
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .remove([filePath]);

    if (error) {
      logger.warn(`Failed to delete file from storage: ${error.message}`);
    }
  }

  async uploadAndSave(
    file: Express.Multer.File,
    teacherId: string,
    lessonId: string,
  ): Promise<{ record: { id: string; filePath: string; displayName: string; fileSize: number; mimeType: string }; indexingStatus: IndexingStatus }> {
    const key = `teachers/${teacherId}/lessons/${lessonId}/${uuidv4()}.pdf`;

    const filePath = await this.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    const record = await prisma.lessonMaterial.create({
      data: {
        lessonId,
        filePath,
        displayName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    logger.info("material_processing_started", {
      lessonId,
      materialId: record.id,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    let indexingStatus: IndexingStatus = "pending";
    try {
      const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
      const textResult = await parser.getText();
      const text = textResult.text.trim();
      const nonWhitespace = text.replace(/\s+/g, "").length;
      logger.info("material_text_extracted", {
        lessonId,
        materialId: record.id,
        pageCount: textResult.total ?? 0,
        characterCount: text.length,
        nonWhitespaceCharacterCount: nonWhitespace,
      });
      if (nonWhitespace > 0) {
        try {
          await aiService.indexLesson(lessonId, text, {
            fileName: file.originalname,
            filePath,
            materialId: record.id,
          });
          indexingStatus = "ready";
        } catch (err: unknown) {
          indexingStatus = "failed";
          logger.info("material_processing_failed", {
            lessonId,
            materialId: record.id,
            safeErrorCode: "EMBEDDING_FAILED",
          });
        }
      } else {
        indexingStatus = "failed";
        logger.info("material_processing_failed", {
          lessonId,
          materialId: record.id,
          safeErrorCode: "OCR_REQUIRED",
          pageCount: textResult.total ?? 0,
        });
      }
    } catch (err: unknown) {
      indexingStatus = "failed";
      logger.info("material_processing_failed", {
        lessonId,
        materialId: record.id,
        safeErrorCode: "CORRUPT_PDF",
      });
    }

    return { record, indexingStatus };
  }
}
