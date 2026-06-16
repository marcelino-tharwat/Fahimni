import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { stagePublicFields } from "./stage.types.js";
import type { StageResponseDTO } from "./stage.types.js";
import type { CreateStageInput, UpdateStageInput } from "./stage.validation.js";

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

  public async delete(id: string, teacherId: string): Promise<void> {
    const existing = await prisma.stage.findFirst({
      where: { id, teacherId, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Stage not found", 404);
    }

    const chaptersCount = await prisma.chapter.count({
      where: { stageId: id, deletedAt: null },
    });

    if (chaptersCount > 0) {
      throw new AppError(
        "Cannot delete stage with existing chapters. Remove or reassign chapters first.",
        409,
      );
    }

    await prisma.stage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
