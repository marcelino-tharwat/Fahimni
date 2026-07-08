import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { deriveQuizDisplayStatus } from "./quiz-attempt-display.js";
import type {
  LessonQuizzesSectionDTO,
  StudentQuizVisibilityDTO,
} from "./quiz-visibility.types.js";
import type { AttemptState } from "./attempts.service.js";
import { resolveStudentQuizSourceScopes } from "./quiz-scope.js";
import type {
  QuizSourceScope,
  QuizSourceScopeRow,
  QuizSourceRefDTO,
} from "./quiz-scope.js";

const quizVisibilitySelect = {
  id: true,
  title: true,
  description: true,
  chapterId: true,
  status: true,
  contentScope: true,
  sourceScope: true,
  sourceChapterIds: true,
  sourceStageId: true,
  questionCount: true,
  totalPoints: true,
  durationMinutes: true,
  passingScore: true,
  quizLessons: { select: { lessonId: true } },
} as const;

type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  status: string;
  contentScope: "CHAPTER" | "SELECTED_LESSONS";
  sourceScope: QuizSourceScope;
  sourceChapterIds: string[];
  sourceStageId: string | null;
  questionCount: number;
  totalPoints: number;
  durationMinutes: number | null;
  passingScore: number | null;
  quizLessons: { lessonId: string }[];
};

function toAttemptState(status: string | undefined): AttemptState {
  if (status === "IN_PROGRESS" || status === "COMPLETED" || status === "GRADED") {
    return status;
  }
  return "NOT_STARTED";
}

function buildVisibilityDto(
  quiz: QuizRow,
  attempt:
    | { id: string; status: string; score: number | null; totalPoints: number }
    | undefined,
  options: {
    requiredForLessonId: string | null;
    linkedLessonIds: string[];
    source?: { chapters?: QuizSourceRefDTO[]; stage?: QuizSourceRefDTO };
  },
): StudentQuizVisibilityDTO {
  const display = deriveQuizDisplayStatus(
    attempt
      ? {
          status: attempt.status,
          score: attempt.score,
          totalPoints: attempt.totalPoints,
        }
      : undefined,
    quiz.passingScore,
  );

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    chapterId: quiz.chapterId!,
    status: "PUBLISHED",
    contentScope: quiz.contentScope,
    sourceScope: quiz.sourceScope,
    ...(options.source?.chapters ? { sourceChapters: options.source.chapters } : {}),
    ...(options.source?.stage ? { sourceStage: options.source.stage } : {}),
    linkedLessonIds: options.linkedLessonIds,
    isRequiredForProgression: options.requiredForLessonId !== null,
    requiredForLessonId: options.requiredForLessonId,
    questionCount: quiz.questionCount,
    totalPoints: quiz.totalPoints,
    durationMinutes: quiz.durationMinutes,
    passingScore: quiz.passingScore,
    studentAttemptStatus: toAttemptState(attempt?.status),
    attemptId: attempt?.id ?? null,
    displayStatus: display.status,
    ...(display.score !== undefined ? { score: display.score } : {}),
    ...(display.retakeAllowed !== undefined ? { retakeAllowed: display.retakeAllowed } : {}),
  };
}

export class QuizVisibilityService {
  /** Published quizzes for a chapter, optionally filtered to a lesson placement context. */
  async listChapterQuizzesForStudent(
    studentId: string,
    chapterId: string,
    lessonId?: string,
  ): Promise<StudentQuizVisibilityDTO[]> {
    const where: {
      chapterId: string;
      status: "PUBLISHED";
      OR?: Array<
        | { contentScope: "SELECTED_LESSONS"; quizLessons: { some: { lessonId: string } } }
        | { progressionGateLessons: { some: { id: string } } }
      >;
    } = { chapterId, status: "PUBLISHED" };

    if (lessonId) {
      where.OR = [
        { contentScope: "SELECTED_LESSONS", quizLessons: { some: { lessonId } } },
        { progressionGateLessons: { some: { id: lessonId } } },
      ];
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      select: quizVisibilitySelect,
      orderBy: { createdAt: "desc" },
    });

    return this.mapQuizzesWithAttempts(studentId, quizzes, lessonId ?? null);
  }

  /** Structured lesson quiz section for student lesson detail. */
  async buildLessonQuizzesSection(
    studentId: string,
    lessonId: string,
    chapterId: string,
    requiredQuizId: string | null,
    progressStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  ): Promise<LessonQuizzesSectionDTO> {
    const lessonLinked = await prisma.quiz.findMany({
      where: {
        chapterId,
        status: "PUBLISHED",
        contentScope: "SELECTED_LESSONS",
        quizLessons: { some: { lessonId } },
      },
      select: quizVisibilitySelect,
      orderBy: { createdAt: "asc" },
    });

    const optionalCandidates = lessonLinked.filter((q) => q.id !== requiredQuizId);
    const available = await this.mapQuizzesWithAttempts(
      studentId,
      optionalCandidates,
      lessonId,
    );

    let required: StudentQuizVisibilityDTO | null = null;
    if (requiredQuizId && progressStatus === "COMPLETED") {
      const reqQuiz = await prisma.quiz.findFirst({
        where: { id: requiredQuizId, chapterId, status: "PUBLISHED" },
        select: quizVisibilitySelect,
      });
      if (reqQuiz) {
        const mapped = await this.mapQuizzesWithAttempts(
          studentId,
          [reqQuiz],
          lessonId,
          requiredQuizId,
        );
        required = mapped[0] ?? null;
      }
    }

    return { available, required };
  }

  private async mapQuizzesWithAttempts(
    studentId: string,
    quizzes: QuizRow[],
    contextLessonId: string | null,
    forceRequiredForLessonId?: string,
  ): Promise<StudentQuizVisibilityDTO[]> {
    if (quizzes.length === 0) return [];

    const quizIds = quizzes.map((q) => q.id);
    const [attempts, gateLessons, sourceScopes] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { studentId, quizId: { in: quizIds } },
        select: {
          id: true,
          quizId: true,
          status: true,
          score: true,
          totalPoints: true,
        },
      }),
      prisma.lesson.findMany({
        where: { requiredQuizId: { in: quizIds }, deletedAt: null },
        select: { id: true, requiredQuizId: true },
      }),
      resolveStudentQuizSourceScopes(
        quizzes.map((q) => ({
          id: q.id,
          sourceScope: q.sourceScope,
          sourceChapterIds: q.sourceChapterIds,
          sourceStageId: q.sourceStageId,
        })) as QuizSourceScopeRow[],
        studentId,
      ),
    ]);

    const attemptByQuiz = new Map(attempts.map((a) => [a.quizId, a]));
    const requiredForByQuiz = new Map(
      gateLessons
        .filter((l): l is typeof l & { requiredQuizId: string } => l.requiredQuizId !== null)
        .map((l) => [l.requiredQuizId, l.id]),
    );

    return quizzes.map((quiz) => {
      const linkedLessonIds = quiz.quizLessons.map((r) => r.lessonId);
      const gateLessonId = requiredForByQuiz.get(quiz.id) ?? null;
      const requiredForLessonId =
        forceRequiredForLessonId !== undefined
          ? forceRequiredForLessonId
          : gateLessonId === contextLessonId
            ? gateLessonId
            : null;

      const src = sourceScopes.get(quiz.id);
      return buildVisibilityDto(quiz, attemptByQuiz.get(quiz.id), {
        requiredForLessonId,
        linkedLessonIds,
        ...(src
          ? {
              source: {
                ...(src.chapters ? { chapters: src.chapters } : {}),
                ...(src.stage ? { stage: src.stage } : {}),
              },
            }
          : {}),
      });
    });
  }

  /** Validate lesson belongs to chapter (for query param guard). */
  async assertLessonInChapter(lessonId: string, chapterId: string): Promise<void> {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, chapterId, deletedAt: null },
      select: { id: true },
    });
    if (!lesson) {
      throw new AppError(
        "Lesson does not belong to this chapter",
        400,
        "LESSON_NOT_IN_CHAPTER",
      );
    }
  }
}

export const quizVisibilityService = new QuizVisibilityService();
