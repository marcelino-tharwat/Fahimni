import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  assertLessonUnlocked,
  evaluateChapterLessons,
} from "../progression/lesson-progression.js";
import { loadChapterProgressionContext } from "../progression/progression-context.js";

export interface LoadedMaterialContext {
  material: {
    id: string;
    filePath: string;
    displayName: string;
    fileSize: number;
    mimeType: string;
    lessonId: string;
  };
  lesson: {
    id: string;
    title: string;
    chapterId: string;
    deletedAt: Date | null;
  };
  chapter: {
    id: string;
    stageId: string;
    price: number | null;
    teacherId: string;
  };
}

export async function loadActiveMaterial(
  materialId: string,
): Promise<LoadedMaterialContext> {
  const row = await prisma.lessonMaterial.findFirst({
    where: { id: materialId, deletedAt: null },
    select: {
      id: true,
      filePath: true,
      displayName: true,
      fileSize: true,
      mimeType: true,
      lessonId: true,
      lesson: {
        select: {
          id: true,
          title: true,
          chapterId: true,
          deletedAt: true,
          chapter: {
            select: {
              id: true,
              stageId: true,
              price: true,
              teacherId: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (
    !row ||
    row.lesson.deletedAt !== null ||
    row.lesson.chapter.deletedAt !== null
  ) {
    throw new AppError("Material not found", 404);
  }

  return {
    material: {
      id: row.id,
      filePath: row.filePath,
      displayName: row.displayName,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      lessonId: row.lessonId,
    },
    lesson: {
      id: row.lesson.id,
      title: row.lesson.title,
      chapterId: row.lesson.chapterId,
      deletedAt: row.lesson.deletedAt,
    },
    chapter: {
      id: row.lesson.chapter.id,
      stageId: row.lesson.chapter.stageId,
      price:
        row.lesson.chapter.price !== null
          ? Number(row.lesson.chapter.price)
          : null,
      teacherId: row.lesson.chapter.teacherId,
    },
  };
}

async function assertStudentChapterAccess(
  studentId: string,
  chapter: { id: string; price: number | null },
): Promise<void> {
  const price = chapter.price;
  if (price === null || price <= 0) return;

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, chapterId: chapter.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!enrollment) {
    throw new AppError(
      "You need to enroll in this chapter to access this material.",
      403,
      "NOT_ENROLLED",
    );
  }
}

export async function assertStudentMaterialAccess(
  studentId: string,
  ctx: LoadedMaterialContext,
): Promise<void> {
  await assertStudentChapterAccess(studentId, ctx.chapter);

  const progressionCtx = await loadChapterProgressionContext(
    studentId,
    ctx.chapter.id,
    ctx.chapter.price,
  );
  const lessonIndex = progressionCtx.lessons.findIndex(
    (l) => l.id === ctx.lesson.id,
  );
  if (lessonIndex < 0) {
    throw new AppError("Lesson not found", 404);
  }

  const access = evaluateChapterLessons(progressionCtx)[lessonIndex]!;
  assertLessonUnlocked(access, {
    studentId,
    chapterId: ctx.chapter.id,
  });
}

export async function assertTeacherMaterialAccess(
  teacherId: string,
  ctx: LoadedMaterialContext,
): Promise<void> {
  if (ctx.chapter.teacherId !== teacherId) {
    throw new AppError("Material not found", 404);
  }
}

export async function assertMaterialPathOwnedByTeacher(
  teacherId: string,
  filePath: string,
): Promise<void> {
  const material = await prisma.lessonMaterial.findFirst({
    where: {
      filePath,
      deletedAt: null,
      lesson: {
        deletedAt: null,
        chapter: {
          deletedAt: null,
          teacherId,
        },
      },
    },
    select: { id: true },
  });

  if (!material) {
    throw new AppError("File not found", 404);
  }
}
