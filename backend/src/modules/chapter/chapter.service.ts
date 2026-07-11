import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { FilesService } from "../files/files.service.js";
import { chapterPublicFields } from "./chapter.types.js";
import type { ChapterResponseDTO, StudentChapterResponseDTO } from "./chapter.types.js";
import type { CreateChapterInput, UpdateChapterInput } from "./chapter.validation.js";

const filesService = new FilesService();
const TEACHER_SUBJECT_MISMATCH_MESSAGE =
  "لا يمكن للمدرس إضافة محتوى في تخصص مختلف عن تخصصه";

function toDTO(
  chapter: Record<string, unknown>,
  lessonsCount: number,
): ChapterResponseDTO {
  return {
    ...chapter,
    price: chapter.price !== null ? Number(chapter.price) : null,
    lessonsCount,
  } as unknown as ChapterResponseDTO;
}

export class ChapterService {
  private async countLessons(chapterId: string): Promise<number> {
    return prisma.lesson.count({ where: { chapterId, deletedAt: null } });
  }

  public async create(
    input: CreateChapterInput,
    stageId: string,
    teacherId: string,
    imageUrl?: string | null,
  ): Promise<ChapterResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, deletedAt: null, isActive: true },
    });

    if (!stage) {
      throw new AppError("Stage not found or inactive", 404);
    }

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
      select: {
        id: true,
        teacherProfile: { select: { subject: true } },
      },
    });

    if (!teacher) {
      throw new AppError("Teacher not approved", 403, "TEACHER_NOT_APPROVED");
    }

    const teacherSubject = teacher.teacherProfile?.subject?.trim();
    const requestedSubject = input.subject?.trim();
    if (requestedSubject && teacherSubject && requestedSubject !== teacherSubject) {
      throw new AppError(TEACHER_SUBJECT_MISMATCH_MESSAGE, 403, "TEACHER_SUBJECT_MISMATCH");
    }

    const chapter = await prisma.chapter.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        price: input.price ?? null,
        imageUrl: imageUrl ?? null,
        teacherId,
        stageId,
      },
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    await auditLogService.record({
      action: "CHAPTER_CREATED",
      resourceType: "CHAPTER",
      resourceId: chapter.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { name: chapter.name, stageId },
    });

    return toDTO(chapter as unknown as Record<string, unknown>, 0);
  }

  public async listByStage(
    stageId: string,
    teacherId: string,
  ): Promise<ChapterResponseDTO[]> {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, deletedAt: null, isActive: true },
      select: { id: true },
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    const chapters = await prisma.chapter.findMany({
      where: { stageId, teacherId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    return Promise.all(
      chapters.map(async (ch) =>
        toDTO(
          ch as unknown as Record<string, unknown>,
          await this.countLessons(ch.id),
        ),
      ),
    );
  }

  public async getById(
    id: string,
    teacherId: string,
  ): Promise<ChapterResponseDTO> {
    const chapter = await prisma.chapter.findFirst({
      where: { id, teacherId, deletedAt: null },
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    return toDTO(
      chapter as unknown as Record<string, unknown>,
      await this.countLessons(chapter.id),
    );
  }

  /**
   * Student-facing variant of getById. Does NOT filter by teacherId
   * (students have no teacher relationship), but still excludes soft-deleted
   * chapters. Returns a lighter DTO with stageName instead of internal fields.
   */
  public async getByIdForStudent(
    id: string,
  ): Promise<StudentChapterResponseDTO> {
    const chapter = await prisma.chapter.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        stageId: true,
        stage: {
          select: { name: true },
        },
      },
    });

    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    return {
      id: chapter.id,
      name: chapter.name,
      description: chapter.description,
      price: chapter.price !== null ? Number(chapter.price) : null,
      imageUrl: chapter.imageUrl,
      stageId: chapter.stageId,
      stageName: chapter.stage.name,
      lessonsCount: await this.countLessons(chapter.id),
    };
  }

  public async update(
    id: string,
    teacherId: string,
    input: UpdateChapterInput,
    imageUrl?: string | null,
  ): Promise<ChapterResponseDTO> {
    const existing = await prisma.chapter.findFirst({
      where: { id, teacherId, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Chapter not found", 404);
    }

    const data: Record<string, string | number | null> = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }
    if (input.price !== undefined) {
      data.price = input.price;
    }
    if (imageUrl !== undefined) {
      data.imageUrl = imageUrl;
    }

    const chapter = await prisma.chapter.update({
      where: { id },
      data,
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    await auditLogService.record({
      action: "CHAPTER_UPDATED",
      resourceType: "CHAPTER",
      resourceId: chapter.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { name: chapter.name },
    });

    return toDTO(
      chapter as unknown as Record<string, unknown>,
      await this.countLessons(id),
    );
  }

  public async delete(id: string, teacherId: string, force: boolean): Promise<void> {
    const chapter = await prisma.chapter.findFirst({
      where: { id, teacherId, deletedAt: null },
      include: {
        lessons: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            lessonMaterials: {
              where: { deletedAt: null },
              select: { filePath: true },
            },
          },
        },
        stage: { select: { name: true } },
      },
    });

    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    const lessons = chapter.lessons;

    if (lessons.length > 0 && !force) {
      throw new AppError(
        `This chapter contains ${lessons.length} lessons. Use ?force=true to confirm deletion.`,
        409,
      );
    }

    if (lessons.length === 0) {
      await prisma.chapter.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await auditLogService.record({
        action: "CHAPTER_DELETED",
        resourceType: "CHAPTER",
        resourceId: id,
        actorId: teacherId,
        actorType: "TEACHER",
        scopeTeacherId: teacherId,
        details: { name: chapter.name, stageName: chapter.stage.name },
      });
      return;
    }

    const lessonIds = lessons.map((l) => l.id);
    const allFilePaths = lessons
      .flatMap((l) => (l.lessonMaterials as Array<{ filePath: string }> ?? []).map((m) => m.filePath))
      .filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.lesson.updateMany({
        where: { id: { in: lessonIds } },
        data: { deletedAt: new Date() },
      });

      await tx.lessonMaterial.updateMany({
        where: { lessonId: { in: lessonIds }, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await tx.chapter.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await auditLogService.record(
        {
          action: "CHAPTER_DELETED",
          resourceType: "CHAPTER",
          resourceId: id,
          actorId: teacherId,
          actorType: "TEACHER",
          scopeTeacherId: teacherId,
          details: {
            name: chapter.name,
            stageName: chapter.stage.name,
            lessonsDeleted: lessons.length,
          },
        },
        tx,
      );
    });

    await Promise.all(
      allFilePaths.map((filePath) =>
        filesService.deleteFile(filePath).catch((err) =>
          logger.warn(`Failed to delete file from storage: ${filePath}`, err),
        ),
      ),
    );
  }

  public async reorder(
    ids: string[],
    teacherId: string,
  ): Promise<ChapterResponseDTO[]> {
    const updated = await prisma.$transaction(async (tx) => {
      const requested = await tx.chapter.findMany({
        where: {
          id: { in: ids },
          teacherId,
          deletedAt: null,
        },
        include: { stage: { select: { id: true } } },
      });

      if (requested.length !== ids.length) {
        throw new AppError("One or more chapters not found", 404);
      }

      const stageIds = new Set(requested.map((c) => c.stage.id));
      if (stageIds.size > 1) {
        throw new AppError("All chapters must belong to the same stage", 400);
      }

      const stageId = [...stageIds][0]!;

      const allChapters = await tx.chapter.findMany({
        where: { stageId, teacherId, deletedAt: null },
        select: { id: true },
      });

      const dbIds = allChapters.map((c) => c.id).sort();
      const requestIds = [...ids].sort();
      if (JSON.stringify(dbIds) !== JSON.stringify(requestIds)) {
        throw new AppError(
          "Request must include all chapters in the stage. Missing or extra IDs detected.",
          400,
        );
      }

      for (let i = 0; i < ids.length; i++) {
        await tx.chapter.update({
          where: { id: ids[i]! },
          data: { sortOrder: i + 1 },
        });
      }

      return tx.chapter.findMany({
        where: { id: { in: ids } },
        select: { ...chapterPublicFields, price: true },
        orderBy: { sortOrder: "asc" },
      });
    });

    return Promise.all(
      updated.map(async (ch) =>
        toDTO(
          ch as unknown as Record<string, unknown>,
          await this.countLessons(ch.id),
        ),
      ),
    );
  }
}
