import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { chapterPublicFields } from "./chapter.types.js";
import type { ChapterResponseDTO } from "./chapter.types.js";
import type { CreateChapterInput, UpdateChapterInput } from "./chapter.validation.js";

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
    return prisma.lesson.count({ where: { chapterId } });
  }

  public async create(
    input: CreateChapterInput,
    stageId: string,
    teacherId: string,
  ): Promise<ChapterResponseDTO> {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, teacherId, deletedAt: null },
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    const chapter = await prisma.chapter.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        price: input.price ?? null,
        stageId,
      },
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    return toDTO(chapter as unknown as Record<string, unknown>, 0);
  }

  public async listByStage(
    stageId: string,
    teacherId: string,
  ): Promise<ChapterResponseDTO[]> {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, teacherId, deletedAt: null },
      select: { id: true },
    });

    if (!stage) {
      throw new AppError("Stage not found", 404);
    }

    const chapters = await prisma.chapter.findMany({
      where: { stageId, deletedAt: null },
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
      where: { id, deletedAt: null, stage: { teacherId, deletedAt: null } },
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

  public async update(
    id: string,
    teacherId: string,
    input: UpdateChapterInput,
  ): Promise<ChapterResponseDTO> {
    const existing = await prisma.chapter.findFirst({
      where: { id, deletedAt: null, stage: { teacherId, deletedAt: null } },
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

    const chapter = await prisma.chapter.update({
      where: { id },
      data,
      select: {
        ...chapterPublicFields,
        price: true,
      },
    });

    return toDTO(
      chapter as unknown as Record<string, unknown>,
      await this.countLessons(id),
    );
  }

  public async delete(id: string, teacherId: string): Promise<void> {
    const existing = await prisma.chapter.findFirst({
      where: { id, deletedAt: null, stage: { teacherId, deletedAt: null } },
    });

    if (!existing) {
      throw new AppError("Chapter not found", 404);
    }

    const lessonsCount = await this.countLessons(id);
    if (lessonsCount > 0) {
      throw new AppError(
        "Cannot delete chapter with existing lessons. Remove or reassign lessons first.",
        409,
      );
    }

    await prisma.chapter.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
