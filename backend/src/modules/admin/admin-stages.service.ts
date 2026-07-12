import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { stagePublicFields } from "../stage/stage.types.js";
import type { StageResponseDTO } from "../stage/stage.types.js";
import type { ListStagesQuery, CreateStageInput, UpdateStageInput } from "./admin-stages.validation.js";

function toLocalizedStage<T extends { name: string; nameAr: string | null; nameEn: string | null; description?: string | null; descriptionAr?: string | null; descriptionEn?: string | null }>(
  stage: T,
): T & { displayName: string; displayDescription: string | null } {
  return {
    ...stage,
    displayName: stage.nameAr ?? stage.nameEn ?? stage.name,
    displayDescription: stage.descriptionAr ?? stage.descriptionEn ?? stage.description ?? null,
  };
}

function attachCounts<T extends { id: string }>(
  stage: T,
): Promise<T & { chapterCount: number; lessonCount: number }> {
  return Promise.all([
    prisma.chapter.count({ where: { stageId: stage.id, deletedAt: null } }),
    prisma.lesson.count({
      where: { chapter: { stageId: stage.id, deletedAt: null }, deletedAt: null },
    }),
  ]).then(([chapterCount, lessonCount]) => ({ ...stage, chapterCount, lessonCount }));
}

export class AdminStagesService {
  async list(query: ListStagesQuery): Promise<{
    data: StageResponseDTO[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, isActive, sortBy, sort } = query;
    const where: Record<string, unknown> = { deletedAt: null };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, stages] = await Promise.all([
      prisma.stage.count({ where: where as any }),
      prisma.stage.findMany({
        where: where as any,
        orderBy: { [sortBy]: sort },
        select: stagePublicFields,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = await Promise.all(stages.map((s) => attachCounts(toLocalizedStage(s))));
    return {
      data: data as unknown as StageResponseDTO[],
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<StageResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id, deletedAt: null },
      select: stagePublicFields,
    });

    if (!stage) {
      throw new AppError("Stage not found", 404, "STAGE_NOT_FOUND");
    }

    return attachCounts(toLocalizedStage(stage)) as unknown as StageResponseDTO;
  }

  async create(input: CreateStageInput, adminId: string): Promise<StageResponseDTO> {
    const stage = await prisma.stage.create({
      data: {
        name: input.name ?? input.nameAr,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        description: input.description ?? input.descriptionAr ?? null,
        descriptionAr: input.descriptionAr ?? input.description ?? null,
        descriptionEn: input.descriptionEn ?? input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        teacherId: null,
      },
      select: stagePublicFields,
    });

    await auditLogService.record({
      action: "STAGE_CREATED",
      resourceType: "STAGE",
      resourceId: stage.id,
      actorId: adminId,
      actorType: "ADMIN",
      scopeTeacherId: null,
      details: { name: stage.name },
    });

    return attachCounts(toLocalizedStage(stage)) as unknown as StageResponseDTO;
  }

  async update(id: string, input: UpdateStageInput, adminId: string): Promise<StageResponseDTO> {
    const existing = await prisma.stage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Stage not found", 404, "STAGE_NOT_FOUND");
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.nameAr !== undefined) data.nameAr = input.nameAr;
    if (input.nameEn !== undefined) data.nameEn = input.nameEn;
    if (input.name === undefined && input.nameAr !== undefined) data.name = input.nameAr;
    if (input.description !== undefined) data.description = input.description;
    if (input.descriptionAr !== undefined) data.descriptionAr = input.descriptionAr;
    if (input.descriptionEn !== undefined) data.descriptionEn = input.descriptionEn;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    data.teacherId = null;

    const stage = await prisma.stage.update({
      where: { id },
      data,
      select: stagePublicFields,
    });

    await auditLogService.record({
      action: "STAGE_UPDATED",
      resourceType: "STAGE",
      resourceId: stage.id,
      actorId: adminId,
      actorType: "ADMIN",
      scopeTeacherId: null,
      details: { name: stage.name, nameAr: stage.nameAr, nameEn: stage.nameEn },
    });

    return attachCounts(toLocalizedStage(stage)) as unknown as StageResponseDTO;
  }

  async delete(id: string, adminId: string): Promise<void> {
    const existing = await prisma.stage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Stage not found", 404, "STAGE_NOT_FOUND");
    }

    const chapterCount = await prisma.chapter.count({
      where: { stageId: id, deletedAt: null },
    });

    if (chapterCount > 0) {
      throw new AppError(
        `Cannot delete stage with ${chapterCount} active chapters. Remove or reassign chapters first.`,
        409,
        "STAGE_HAS_CHAPTERS",
      );
    }

    await prisma.stage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await auditLogService.record({
      action: "STAGE_DELETED",
      resourceType: "STAGE",
      resourceId: id,
      actorId: adminId,
      actorType: "ADMIN",
      scopeTeacherId: null,
      details: { name: existing.name },
    });
  }

  async reorder(ids: string[], adminId: string): Promise<StageResponseDTO[]> {
    return prisma.$transaction(async (tx) => {
      const stages = await tx.stage.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });

      if (stages.length !== ids.length) {
        throw new AppError("One or more stages not found", 404, "STAGE_NOT_FOUND");
      }

      for (let i = 0; i < ids.length; i++) {
        await tx.stage.update({
          where: { id: ids[i]! },
          data: { sortOrder: i + 1 },
        });
      }

      await auditLogService.record(
        {
          action: "STAGES_REORDERED",
          resourceType: "STAGE",
          resourceId: ids.join(","),
          actorId: adminId,
          actorType: "ADMIN",
          scopeTeacherId: null,
          details: { count: ids.length },
        },
        tx,
      );

      return tx.stage.findMany({
        where: { id: { in: ids } },
        select: stagePublicFields,
        orderBy: { sortOrder: "asc" },
      });
    }).then((stages) =>
      Promise.all(stages.map((s) => attachCounts(toLocalizedStage(s)))) as unknown as Promise<StageResponseDTO[]>
    );
  }
}

export const adminStagesService = new AdminStagesService();
