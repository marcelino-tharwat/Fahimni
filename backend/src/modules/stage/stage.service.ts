import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { stagePublicFields } from "./stage.types.js";
import type { StageResponseDTO } from "./stage.types.js";

function localizeStage<
  T extends {
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    description?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
  },
>(stage: T, locale = "ar"): T & { displayName: string; displayDescription: string | null } {
  const isEnglish = locale.toLowerCase().startsWith("en");
  return {
    ...stage,
    displayName: (isEnglish ? stage.nameEn : stage.nameAr) ?? stage.name,
    displayDescription: (isEnglish ? stage.descriptionEn : stage.descriptionAr) ?? stage.description ?? null,
  };
}

export class StageService {
  /**
   * Public listing — no auth, no teacher filter. Returns lightweight
   * stage objects for the signup dropdown.
   */
  public async listPublic(locale = "ar"): Promise<Pick<StageResponseDTO, "id" | "name" | "nameAr" | "nameEn" | "displayName" | "sortOrder">[]> {
    const stages = await prisma.stage.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameEn: true,
        description: true,
        descriptionAr: true,
        descriptionEn: true,
        sortOrder: true,
      },
    });
    return stages.map((stage) => localizeStage(stage, locale));
  }

  private async attachCounts<T extends { id: string }>(
    stage: T,
  ): Promise<T & { chapterCount: number; lessonCount: number }> {
    const [chapterCount, lessonCount] = await Promise.all([
      prisma.chapter.count({ where: { stageId: stage.id, deletedAt: null } }),
      prisma.lesson.count({
        where: {
          chapter: { stageId: stage.id, deletedAt: null },
          deletedAt: null,
        },
      }),
    ]);
    return { ...stage, chapterCount, lessonCount };
  }

  /**
   * List all active stages (admin-managed, teachers browse them).
   */
  public async list(locale = "ar"): Promise<StageResponseDTO[]> {
    const stages = await prisma.stage.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: stagePublicFields,
    });

    const withCounts = await Promise.all(
      stages.map((s) => this.attachCounts(localizeStage(s, locale))),
    );

    return withCounts as unknown as StageResponseDTO[];
  }

  /**
   * Get one active stage by ID.
   */
  public async getById(id: string, locale = "ar"): Promise<StageResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: stagePublicFields,
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    return this.attachCounts(localizeStage(stage, locale)) as unknown as StageResponseDTO;
  }
}
