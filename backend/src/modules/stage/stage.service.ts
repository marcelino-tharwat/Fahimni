import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { stagePublicFields } from "./stage.types.js";
import type { StageResponseDTO } from "./stage.types.js";

export class StageService {
  /**
   * Public listing — no auth, no teacher filter. Returns lightweight
   * stage objects for the signup dropdown.
   */
  public async listPublic(): Promise<Pick<StageResponseDTO, "id" | "name" | "sortOrder">[]> {
    return prisma.stage.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    });
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
  public async list(): Promise<StageResponseDTO[]> {
    const stages = await prisma.stage.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: stagePublicFields,
    });

    const withCounts = await Promise.all(
      stages.map((s) => this.attachCounts(s)),
    );

    return withCounts as unknown as StageResponseDTO[];
  }

  /**
   * Get one active stage by ID.
   */
  public async getById(id: string): Promise<StageResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: stagePublicFields,
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    return this.attachCounts(stage) as unknown as StageResponseDTO;
  }
}
