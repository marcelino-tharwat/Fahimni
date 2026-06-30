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

  async getSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .createSignedUrl(filePath, 3600);

    if (error || !data) {
      throw new AppError(`Failed to generate signed URL: ${error.message}`, 500);
    }

    return data.signedUrl;
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

    console.warn("AV scan pending for:", filePath);

    let indexingStatus: IndexingStatus = "pending";
    try {
      const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
      const textResult = await parser.getText();
      const text = textResult.text.trim();
      if (text.length > 0) {
        try {
          await aiService.indexLesson(lessonId, text, {
            fileName: file.originalname,
            filePath,
          });
          indexingStatus = "ready";
        } catch (err: unknown) {
          indexingStatus = "failed";
          logger.warn(`[FilesService] Auto-indexing failed: ${err}`);
        }
      } else {
        logger.warn(`[FilesService] No extractable text in PDF ${file.originalname}`);
      }
    } catch (err: unknown) {
      indexingStatus = "failed";
      logger.warn(`[FilesService] PDF text extraction failed: ${err}`);
    }

    return { record, indexingStatus };
  }
}
