import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { FilesService } from "../files/files.service.js";
import { stagePublicFields } from "./stage.types.js";
import type { StageResponseDTO } from "./stage.types.js";
import type { CreateStageInput, UpdateStageInput } from "./stage.validation.js";

const filesService = new FilesService();

export class StageService {
  private async attachChapterCount<T extends { id: string }>(
    stage: T,
  ): Promise<T & { chapterCount: number }> {
    const count = await prisma.chapter.count({
      where: { stageId: stage.id, deletedAt: null },
    });
    return { ...stage, chapterCount: count };
  }

  public async list(teacherId: string): Promise<StageResponseDTO[]> {
    const stages = await prisma.stage.findMany({
      where: { teacherId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: stagePublicFields,
    });

    const withCounts = await Promise.all(
      stages.map((s) => this.attachChapterCount(s)),
    );

    return withCounts as unknown as StageResponseDTO[];
  }

  public async getById(
    id: string,
    teacherId: string,
  ): Promise<StageResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id, teacherId, deletedAt: null },
      select: stagePublicFields,
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    return this.attachChapterCount(stage) as unknown as StageResponseDTO;
  }

  public async create(
    input: CreateStageInput,
    teacherId: string,
  ): Promise<StageResponseDTO> {
    const maxStage = await prisma.stage.aggregate({
      where: { teacherId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const nextSortOrder = (maxStage._max.sortOrder ?? 0) + 1;

    const stage = await prisma.stage.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        sortOrder: nextSortOrder,
        teacherId,
      },
      select: stagePublicFields,
    });

    return { ...stage, chapterCount: 0 } as unknown as StageResponseDTO;
  }

  public async update(
    id: string,
    teacherId: string,
    input: UpdateStageInput,
  ): Promise<StageResponseDTO> {
    const existing = await prisma.stage.findFirst({
      where: { id, teacherId, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Stage not found", 404);
    }

    const data: Record<string, string | null> = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }

    const stage = await prisma.stage.update({
      where: { id },
      data,
      select: stagePublicFields,
    });

    return this.attachChapterCount(stage) as unknown as StageResponseDTO;
  }

  public async delete(id: string, teacherId: string, force: boolean): Promise<void> {
    const stage = await prisma.stage.findFirst({
      where: { id, teacherId, deletedAt: null },
      include: {
        chapters: {
          where: { deletedAt: null },
          include: {
            lessons: {
              where: { deletedAt: null },
              select: { id: true, title: true, pdfUrls: true },
            },
          },
        },
      },
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    const chapters = stage.chapters;
    const allLessons = chapters.flatMap((c) => c.lessons);

    if (chapters.length > 0 && !force) {
      throw new AppError(
        `This stage contains ${chapters.length} chapters and ${allLessons.length} lessons. Use ?force=true to confirm deletion.`,
        409,
      );
    }

    if (chapters.length === 0) {
      await prisma.stage.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return;
    }

    const chapterIds = chapters.map((c) => c.id);
    const lessonIds = allLessons.map((l) => l.id);

    const allPdfUrls = allLessons
      .flatMap((l) => (l.pdfUrls as string[]) ?? [])
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

      await tx.chapter.updateMany({
        where: { id: { in: chapterIds } },
        data: { deletedAt: new Date() },
      });

      await tx.stage.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          action: "DELETE_STAGE",
          resourceType: "STAGE",
          resourceId: id,
          details: {
            name: stage.name,
            chaptersDeleted: chapters.length,
            lessonsDeleted: allLessons.length,
            chapterNames: chapters.map((c) => c.name),
          },
          userId: teacherId,
        },
      });
    });

    await Promise.all(
      allPdfUrls.map((url) =>
        filesService.deleteFile(url).catch((err) =>
          logger.warn(`Failed to delete file from storage: ${url}`, err),
        ),
      ),
    );
  }

  public async reorder(
    ids: string[],
    teacherId: string,
  ): Promise<StageResponseDTO[]> {
    const updated = await prisma.$transaction(async (tx) => {
      const allStages = await tx.stage.findMany({
        where: { teacherId, deletedAt: null },
        select: { id: true },
        orderBy: { sortOrder: "asc" },
      });

      const dbIds = allStages.map((s) => s.id).sort();
      const requestIds = [...ids].sort();

      if (JSON.stringify(dbIds) !== JSON.stringify(requestIds)) {
        throw new AppError(
          "Request must include all stages. Missing or extra IDs detected.",
          400,
        );
      }

      for (let i = 0; i < ids.length; i++) {
        await tx.stage.update({
          where: { id: ids[i]! },
          data: { sortOrder: i + 1 },
        });
      }

      return tx.stage.findMany({
        where: { id: { in: ids } },
        select: stagePublicFields,
        orderBy: { sortOrder: "asc" },
      });
    });

    return Promise.all(
      updated.map((s) => this.attachChapterCount(s)),
    ) as unknown as StageResponseDTO[];
  }
}
