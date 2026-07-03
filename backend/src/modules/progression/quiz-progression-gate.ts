import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

/**
 * Explicitly set Lesson.requiredQuizId for selected lessons after publish.
 * Does not auto-link quizzes; caller must pass lesson IDs intentionally.
 */
export async function applyQuizProgressionGates(
  quizId: string,
  lessonIds: string[],
  teacherId: string,
): Promise<{ updatedLessonIds: string[] }> {
  const uniqueLessonIds = [...new Set(lessonIds)];
  if (uniqueLessonIds.length === 0) {
    return { updatedLessonIds: [] };
  }

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, createdBy: teacherId },
    select: { id: true, chapterId: true, status: true, contentScope: true },
  });

  if (!quiz) {
    throw new AppError("Quiz not found", 404);
  }
  if (quiz.status !== "PUBLISHED") {
    throw new AppError(
      "Quiz must be published before setting progression gates",
      422,
      "QUIZ_NOT_PUBLISHED",
    );
  }
  if (!quiz.chapterId) {
    throw new AppError(
      "Quiz must be assigned to a chapter",
      422,
      "QUIZ_NOT_ASSIGNED",
    );
  }

  if (quiz.contentScope === "SELECTED_LESSONS") {
    const linked = await prisma.quizLesson.findMany({
      where: { quizId, lessonId: { in: uniqueLessonIds } },
      select: { lessonId: true },
    });
    const linkedSet = new Set(linked.map((row) => row.lessonId));
    for (const lessonId of uniqueLessonIds) {
      if (!linkedSet.has(lessonId)) {
        throw new AppError(
          "Progression gate lesson must be linked to this quiz",
          422,
          "PROGRESSION_GATE_LESSON_NOT_LINKED",
        );
      }
    }
  }

  const validLessons = await prisma.lesson.findMany({
    where: {
      id: { in: uniqueLessonIds },
      chapterId: quiz.chapterId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (validLessons.length !== uniqueLessonIds.length) {
    throw new AppError(
      "Progression gate lesson must belong to the quiz chapter",
      422,
      "INVALID_PROGRESSION_GATE_LESSON",
    );
  }

  await prisma.$transaction(
    uniqueLessonIds.map((lessonId) =>
      prisma.lesson.update({
        where: { id: lessonId },
        data: { requiredQuizId: quizId },
      }),
    ),
  );

  return { updatedLessonIds: uniqueLessonIds };
}
