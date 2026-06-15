import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { lessonPublicFields } from "./lessons.types.js";
import type { LessonResponseDTO } from "./lessons.types.js";
import type { CreateLessonInput, UpdateLessonInput } from "./lessons.validation.js";

function toDTO(lesson: Record<string, unknown>): LessonResponseDTO {
  return {
    ...lesson,
    // pdfUrls are stored as S3 object keys (JSONB array). They are returned
    // as-is: the project has no S3/presigning abstraction (storage is
    // Cloudinary), so no presigned URLs are generated on retrieval.
    pdfUrls: (lesson.pdfUrls as string[] | null) ?? null,
  } as unknown as LessonResponseDTO;
}

export class LessonsService {
  // Resolve and authorize a chapter through its Stage ownership chain
  // (Chapter -> Stage -> Teacher). Soft-deleted chapters and stages are
  // excluded so they cannot be used to create or list lessons.
  private async assertChapterOwned(
    chapterId: string,
    teacherId: string,
  ): Promise<void> {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        stage: { teacherId, deletedAt: null },
      },
      select: { id: true },
    });

    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }
  }

  public async create(
    input: CreateLessonInput,
    chapterId: string,
    teacherId: string,
  ): Promise<LessonResponseDTO> {
    await this.assertChapterOwned(chapterId, teacherId);

    const lesson = await prisma.lesson.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        youtubeUrl: input.youtubeUrl ?? null,
        sortOrder: input.sortOrder,
        pdfUrls: input.pdfUrls ?? Prisma.DbNull,
        chapterId,
      },
      select: lessonPublicFields,
    });

    return toDTO(lesson as unknown as Record<string, unknown>);
  }

  public async listByChapter(
    chapterId: string,
    teacherId: string,
  ): Promise<LessonResponseDTO[]> {
    await this.assertChapterOwned(chapterId, teacherId);

    const lessons = await prisma.lesson.findMany({
      where: { chapterId },
      orderBy: { sortOrder: "asc" },
      select: lessonPublicFields,
    });

    return lessons.map((l) => toDTO(l as unknown as Record<string, unknown>));
  }

  public async getById(
    id: string,
    teacherId: string,
  ): Promise<LessonResponseDTO> {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
      },
      select: lessonPublicFields,
    });

    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    return toDTO(lesson as unknown as Record<string, unknown>);
  }

  public async update(
    id: string,
    teacherId: string,
    input: UpdateLessonInput,
  ): Promise<LessonResponseDTO> {
    const existing = await prisma.lesson.findFirst({
      where: {
        id,
        chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Lesson not found", 404);
    }

    const data: Prisma.LessonUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.durationMinutes !== undefined) {
      data.durationMinutes = input.durationMinutes;
    }
    if (input.youtubeUrl !== undefined) {
      data.youtubeUrl = input.youtubeUrl;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }
    if (input.pdfUrls !== undefined) {
      data.pdfUrls = input.pdfUrls ?? Prisma.DbNull;
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data,
      select: lessonPublicFields,
    });

    return toDTO(lesson as unknown as Record<string, unknown>);
  }

  public async delete(id: string, teacherId: string): Promise<void> {
    const existing = await prisma.lesson.findFirst({
      where: {
        id,
        chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Lesson not found", 404);
    }

    await prisma.lesson.delete({ where: { id } });
  }
}
