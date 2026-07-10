import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { FilesService } from "../files/files.service.js";
import type { LessonResponseDTO } from "./lessons.types.js";
import type { CreateLessonInput, UpdateLessonInput } from "./lessons.validation.js";

const filesService = new FilesService();

const lessonSelectWithMaterials = {
  id: true,
  title: true,
  description: true,
  durationMinutes: true,
  youtubeUrl: true,
  sortOrder: true,
  chapterId: true,
  requiredQuizId: true,
  createdAt: true,
  updatedAt: true,
  lessonMaterials: {
    where: { deletedAt: null },
    select: { id: true, filePath: true, displayName: true, fileSize: true, mimeType: true },
  },
} as const;

interface MaterialRow {
  id: string;
  filePath: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
}

function extractMaterials(lesson: Record<string, unknown>): MaterialRow[] {
  return (lesson.lessonMaterials as MaterialRow[] | undefined) ?? [];
}

function stripMaterials(lesson: Record<string, unknown>): Record<string, unknown> {
  const { lessonMaterials: _, ...rest } = lesson;
  return rest;
}

/**
 * Sync DTO for list/reorder endpoints. Returns attachment metadata WITHOUT a
 * signed `url`, so listing N lessons makes zero storage round-trips.
 *
 * Ownership chain: Lesson → Chapter → chapter.teacherId
 */
function toLightDTO(lesson: Record<string, unknown>): LessonResponseDTO {
  const attachments = extractMaterials(lesson).map((m) => ({
    id: m.id,
    filePath: m.filePath,
    displayName: m.displayName,
    fileSize: m.fileSize,
    mimeType: m.mimeType,
  }));

  return { ...stripMaterials(lesson), attachments } as unknown as LessonResponseDTO;
}

/**
 * Async DTO for single-lesson fetches. Includes a signed download `url` per
 * attachment (one storage round-trip each), so use only when serving one lesson.
 */
async function toFullDTO(
  lesson: Record<string, unknown>,
): Promise<LessonResponseDTO> {
  const materials = extractMaterials(lesson);

  const attachments = materials.length
    ? await Promise.all(
        materials.map(async (m) => ({
          id: m.id,
          filePath: m.filePath,
          displayName: m.displayName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          url: await filesService.getSignedUrl(m.filePath),
        })),
      )
    : [];

  return { ...stripMaterials(lesson), attachments } as unknown as LessonResponseDTO;

}

export class LessonsService {
  // Resolve and authorize a chapter through the ownership chain
  // (Chapter → chapter.teacherId). Soft-deleted chapters are excluded
  // so they cannot be used to create or list lessons.
  private async assertChapterOwned(
    chapterId: string,
    teacherId: string,
  ): Promise<void> {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        teacherId,
        deletedAt: null,
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
        chapterId,
      },
      select: lessonSelectWithMaterials,
    });

    await auditLogService.record({
      action: "LESSON_CREATED",
      resourceType: "LESSON",
      resourceId: lesson.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: lesson.title, chapterId },
    });

    await notificationsService.notifyChapterEnrolledStudents(chapterId, {
      type: "NEW_LESSON",
      resourceTitle: lesson.title,
      resourceType: "LESSON",
      resourceId: lesson.id,
      courseContextId: chapterId,
    });

    return toFullDTO(lesson as unknown as Record<string, unknown>);
  }

  public async listByChapter(
    chapterId: string,
    teacherId: string,
  ): Promise<LessonResponseDTO[]> {
    await this.assertChapterOwned(chapterId, teacherId);

    const lessons = await prisma.lesson.findMany({
      where: { chapterId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: lessonSelectWithMaterials,
    });

    return lessons.map((l) => toLightDTO(l as unknown as Record<string, unknown>));
  }

  public async getById(
    id: string,
    teacherId: string,
  ): Promise<LessonResponseDTO> {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        deletedAt: null,
        chapter: { teacherId, deletedAt: null },
      },
      select: lessonSelectWithMaterials,
    });

    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    const linkedQuizzes = await prisma.quiz.findMany({
      where: {
        chapterId: lesson.chapterId,
        status: "PUBLISHED",
        contentScope: "SELECTED_LESSONS",
        quizLessons: { some: { lessonId: id } },
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    const dto = await toFullDTO(lesson as unknown as Record<string, unknown>);
    return { ...dto, linkedQuizzes };
  }

  public async update(
    id: string,
    teacherId: string,
    input: UpdateLessonInput,
  ): Promise<LessonResponseDTO> {
    const existing = await prisma.lesson.findFirst({
      where: {
        id,
        deletedAt: null,
        chapter: { teacherId, deletedAt: null },
      },
      select: { id: true, chapterId: true },
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
    if (input.requiredQuizId !== undefined) {
      if (input.requiredQuizId === null) {
        data.requiredQuiz = { disconnect: true };
      } else {
        const quiz = await prisma.quiz.findFirst({
          where: {
            id: input.requiredQuizId,
            chapterId: existing.chapterId,
            status: "PUBLISHED",
          },
          select: { id: true },
        });
        if (!quiz) {
          throw new AppError(
            "Required quiz must be a published quiz in the same chapter",
            422,
            "INVALID_PROGRESSION_QUIZ",
          );
        }
        data.requiredQuiz = { connect: { id: input.requiredQuizId } };
      }
    }
    const lesson = await prisma.lesson.update({
      where: { id },
      data,
      select: lessonSelectWithMaterials,
    });

    await auditLogService.record({
      action: "LESSON_UPDATED",
      resourceType: "LESSON",
      resourceId: lesson.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: lesson.title },
    });

    return toFullDTO(lesson as unknown as Record<string, unknown>);
  }

  public async delete(id: string, teacherId: string): Promise<void> {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        deletedAt: null,
        chapter: { teacherId, deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        chapter: { select: { id: true, name: true, stageId: true } },
        lessonMaterials: {
          where: { deletedAt: null },
          select: { filePath: true },
        },
      },
    });

    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    const materialPaths = (
      (lesson as unknown as {
        lessonMaterials?: Array<{ filePath: string }>;
      }).lessonMaterials ?? []
    ).map((m) => m.filePath);

    await prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.lessonMaterial.updateMany({
        where: { lessonId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await auditLogService.record(
        {
          action: "LESSON_DELETED",
          resourceType: "LESSON",
          resourceId: id,
          actorId: teacherId,
          actorType: "TEACHER",
          scopeTeacherId: teacherId,
          details: { title: lesson.title, chapterId: lesson.chapter.id },
        },
        tx,
      );
    });

    await Promise.all(
      materialPaths.map((filePath) =>
        filesService.deleteFile(filePath).catch((err) =>
          logger.warn(`Failed to delete file from storage: ${filePath}`, err),
        ),
      ),
    );
  }

  public async reorder(
    ids: string[],
    teacherId: string,
  ): Promise<LessonResponseDTO[]> {
    const updated = await prisma.$transaction(async (tx) => {
      const requested = await tx.lesson.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
          chapter: { teacherId, deletedAt: null },
        },
        include: { chapter: { select: { id: true } } },
      });

      if (requested.length !== ids.length) {
        throw new AppError("One or more lessons not found", 404);
      }

      const chapterIds = new Set(requested.map((l) => l.chapter.id));
      if (chapterIds.size > 1) {
        throw new AppError("All lessons must belong to the same chapter", 400);
      }

      const chapterId = [...chapterIds][0]!;

      const allLessons = await tx.lesson.findMany({
        where: { chapterId, deletedAt: null },
        select: { id: true },
      });

      const dbIds = allLessons.map((l) => l.id).sort();
      const requestIds = [...ids].sort();
      if (JSON.stringify(dbIds) !== JSON.stringify(requestIds)) {
        throw new AppError(
          "Request must include all lessons in the chapter. Missing or extra IDs detected.",
          400,
        );
      }

      for (let i = 0; i < ids.length; i++) {
        await tx.lesson.update({
          where: { id: ids[i]! },
          data: { sortOrder: i + 1 },
        });
      }

      return tx.lesson.findMany({
        where: { id: { in: ids } },
        select: lessonSelectWithMaterials,
        orderBy: { sortOrder: "asc" },
      });
    });

    return updated.map((l) => toLightDTO(l as unknown as Record<string, unknown>));
  }
}
