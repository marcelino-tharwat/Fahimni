import { prisma } from "../../config/database.js";
import type {
  ChapterProgressionContext,
  ProgressionAttemptRow,
  ProgressionLessonRow,
  ProgressionQuizRow,
} from "./lesson-progression.js";
import { pickProgressionAttempt } from "./lesson-progression.js";

export async function loadChapterProgressionContext(
  studentId: string,
  chapterId: string,
  chapterPrice: number | null,
): Promise<ChapterProgressionContext> {
  const enrolled =
    chapterPrice === null ||
    chapterPrice <= 0 ||
    (await prisma.enrollment.findFirst({
      where: { studentId, chapterId, status: "ACTIVE" },
      select: { id: true },
    })) !== null;

  const lessons = await prisma.lesson.findMany({
    where: { chapterId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true, requiredQuizId: true },
  });

  const lessonIds = lessons.map((l) => l.id);
  const requiredQuizIds = lessons
    .map((l) => l.requiredQuizId)
    .filter((id): id is string => id !== null);

  const [progressRows, quizRows, attemptRows] = await Promise.all([
    lessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: { studentId, lessonId: { in: lessonIds }, completed: true },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    requiredQuizIds.length > 0
      ? prisma.quiz.findMany({
          where: { id: { in: requiredQuizIds } },
          select: { id: true, status: true, passingScore: true },
        })
      : Promise.resolve([]),
    requiredQuizIds.length > 0
      ? prisma.quizAttempt.findMany({
          where: { studentId, quizId: { in: requiredQuizIds } },
          select: {
            quizId: true,
            status: true,
            score: true,
            totalPoints: true,
            completedAt: true,
          },
          orderBy: { completedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const completedLessonIds = new Set(progressRows.map((p) => p.lessonId));
  const quizzesById = new Map<string, ProgressionQuizRow>(
    quizRows.map((q) => [q.id, q]),
  );
  const attemptsByQuiz = new Map<string, ProgressionAttemptRow[]>();
  for (const row of attemptRows) {
    const bucket = attemptsByQuiz.get(row.quizId) ?? [];
    bucket.push(row as ProgressionAttemptRow);
    attemptsByQuiz.set(row.quizId, bucket);
  }
  const attemptsByQuizId = new Map<string, ProgressionAttemptRow>();
  for (const [quizId, rows] of attemptsByQuiz) {
    const picked = pickProgressionAttempt(rows);
    if (picked) attemptsByQuizId.set(quizId, picked);
  }

  return {
    chapterId,
    enrolled,
    lessons: lessons as ProgressionLessonRow[],
    completedLessonIds,
    quizzesById,
    attemptsByQuizId,
  };
}

export async function loadLessonProgressionEvaluation(
  studentId: string,
  lessonId: string,
) {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      deletedAt: null,
      chapter: { deletedAt: null, stage: { deletedAt: null } },
    },
    select: {
      id: true,
      chapterId: true,
      chapter: { select: { price: true } },
    },
  });

  if (!lesson) return null;

  const price =
    lesson.chapter.price !== null ? Number(lesson.chapter.price) : null;
  const ctx = await loadChapterProgressionContext(
    studentId,
    lesson.chapterId,
    price,
  );
  const index = ctx.lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return null;

  const { evaluateLessonAccess } = await import("./lesson-progression.js");
  return { ctx, evaluation: evaluateLessonAccess(index, ctx) };
}
