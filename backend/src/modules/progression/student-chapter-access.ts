import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface AccessibleChapterRow {
  id: string;
  name: string;
  price: number | null;
  stage: { id: string; name: string };
}

function chapterPrice(raw: { price: unknown }): number | null {
  return raw.price !== null && raw.price !== undefined ? Number(raw.price) : null;
}

function isFreeChapter(price: number | null): boolean {
  return price === null || price <= 0;
}

/** Chapters a student may access for lessons and quizzes (matches lesson access policy). */
export async function listStudentAccessibleChapters(
  studentId: string,
): Promise<AccessibleChapterRow[]> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { stageId: true },
  });
  if (!profile) return [];

  const [chapters, enrollments] = await Promise.all([
    prisma.chapter.findMany({
      where: { stageId: profile.stageId, deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        stage: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.enrollment.findMany({
      where: { studentId, status: "ACTIVE", chapter: { deletedAt: null } },
      select: { chapterId: true },
    }),
  ]);

  const enrolledIds = new Set(enrollments.map((e) => e.chapterId));

  return chapters
    .filter((ch) => {
      const price = chapterPrice(ch);
      return isFreeChapter(price) || enrolledIds.has(ch.id);
    })
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      price: chapterPrice(ch),
      stage: ch.stage,
    }));
}

export async function assertStudentChapterAccess(
  studentId: string,
  chapterId: string,
): Promise<{ price: number | null }> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, deletedAt: null, stage: { deletedAt: null } },
    select: { id: true, price: true, stageId: true },
  });
  if (!chapter) {
    throw new AppError("Chapter not found", 404);
  }

  const price = chapterPrice(chapter);
  if (isFreeChapter(price)) {
    return { price };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, chapterId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!enrollment) {
    throw new AppError(
      "You need to enroll in this chapter to access this content",
      403,
      "NOT_ENROLLED",
    );
  }

  return { price };
}

/** Returns false when access denied (for Express handlers that write their own 403). */
export async function studentHasChapterAccess(
  studentId: string,
  chapterId: string,
): Promise<boolean> {
  try {
    await assertStudentChapterAccess(studentId, chapterId);
    return true;
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 403) {
      return false;
    }
    throw err;
  }
}
