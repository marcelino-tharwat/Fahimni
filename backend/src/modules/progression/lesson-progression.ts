import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";

export const LESSON_LOCK_REASONS = [
  "ENROLLMENT_REQUIRED",
  "PREVIOUS_LESSON_NOT_COMPLETED",
  "REQUIRED_QUIZ_NOT_COMPLETED",
  "REQUIRED_QUIZ_NOT_PASSED",
  "REQUIRED_QUIZ_AWAITING_GRADING",
  "ATTEMPT_LIMIT_REACHED",
  "LESSON_UNAVAILABLE",
] as const;

export type LessonLockReason = (typeof LESSON_LOCK_REASONS)[number];

export type LessonAccessStatus = "UNLOCKED" | "LOCKED";
export type LessonProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface ProgressionLessonRow {
  id: string;
  sortOrder: number;
  requiredQuizId: string | null;
}

export interface ProgressionQuizRow {
  id: string;
  status: string;
  passingScore: number | null;
}

export interface ProgressionAttemptRow {
  quizId: string;
  status: string;
  score: number | null;
  totalPoints: number;
  completedAt?: Date | null;
}

export interface LessonAccessEvaluation {
  lessonId: string;
  accessStatus: LessonAccessStatus;
  isUnlocked: boolean;
  lockReason: LessonLockReason | null;
  progressStatus: LessonProgressStatus;
  requiredQuizId: string | null;
  nextLessonId: string | null;
  prerequisites: {
    previousLessonCompleted: boolean;
    requiredQuizCount: number;
    completedRequiredQuizCount: number;
  };
}

export interface ChapterProgressionContext {
  chapterId: string;
  enrolled: boolean;
  lessons: ProgressionLessonRow[];
  completedLessonIds: Set<string>;
  quizzesById: Map<string, ProgressionQuizRow>;
  attemptsByQuizId: Map<string, ProgressionAttemptRow>;
}


export function scorePercentage(
  score: number | null,
  totalPoints: number,
): number {
  if (totalPoints <= 0) return 0;
  return ((score ?? 0) / totalPoints) * 100;
}

export function effectivePassingScore(
  quiz: ProgressionQuizRow,
): number | null {
  return quiz.passingScore;
}

export interface QuizRequirementEvaluation {
  satisfied: boolean;
  lockReason:
    | "REQUIRED_QUIZ_NOT_COMPLETED"
    | "REQUIRED_QUIZ_AWAITING_GRADING"
    | "REQUIRED_QUIZ_NOT_PASSED"
    | "ATTEMPT_LIMIT_REACHED"
    | null;
}

/** Whether a published progression quiz requirement is satisfied for unlock. */
export function evaluateQuizRequirement(
  quizId: string,
  ctx: Pick<ChapterProgressionContext, "quizzesById" | "attemptsByQuizId">,
): QuizRequirementEvaluation {
  const quiz = ctx.quizzesById.get(quizId);
  if (!quiz || quiz.status !== "PUBLISHED") {
    return { satisfied: false, lockReason: "REQUIRED_QUIZ_NOT_COMPLETED" };
  }

  const attempt = ctx.attemptsByQuizId.get(quizId);
  if (!attempt) {
    return { satisfied: false, lockReason: "REQUIRED_QUIZ_NOT_COMPLETED" };
  }

  if (attempt.status === "IN_PROGRESS") {
    return { satisfied: false, lockReason: "REQUIRED_QUIZ_NOT_COMPLETED" };
  }

  if (attempt.status === "COMPLETED") {
    return { satisfied: false, lockReason: "REQUIRED_QUIZ_AWAITING_GRADING" };
  }

  if (attempt.status === "GRADED") {
    const threshold = effectivePassingScore(quiz);
    if (threshold === null) {
      return { satisfied: true, lockReason: null };
    }
    const pct = scorePercentage(attempt.score, attempt.totalPoints);
    if (pct >= threshold) {
      return { satisfied: true, lockReason: null };
    }
    return { satisfied: false, lockReason: "REQUIRED_QUIZ_NOT_PASSED" };
  }

  return { satisfied: false, lockReason: "REQUIRED_QUIZ_NOT_COMPLETED" };
}

/** Pick the attempt that should drive progression for a quiz gate. */
export function pickProgressionAttempt(
  attempts: ProgressionAttemptRow[],
): ProgressionAttemptRow | undefined {
  if (attempts.length === 0) return undefined;

  const byRecency = [...attempts].sort(
    (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
  );

  const finalized = byRecency.find(
    (a) => a.status === "GRADED" || a.status === "COMPLETED",
  );
  if (finalized) return finalized;

  return byRecency.find((a) => a.status === "IN_PROGRESS");
}

function progressStatusFor(
  lessonId: string,
  completedLessonIds: Set<string>,
): LessonProgressStatus {
  return completedLessonIds.has(lessonId) ? "COMPLETED" : "NOT_STARTED";
}

export function evaluateLessonAccess(
  lessonIndex: number,
  ctx: ChapterProgressionContext,
): LessonAccessEvaluation {
  const lesson = ctx.lessons[lessonIndex];
  if (!lesson) {
    return {
      lessonId: "",
      accessStatus: "LOCKED",
      isUnlocked: false,
      lockReason: "LESSON_UNAVAILABLE",
      progressStatus: "NOT_STARTED",
      requiredQuizId: null,
      nextLessonId: null,
      prerequisites: {
        previousLessonCompleted: false,
        requiredQuizCount: 0,
        completedRequiredQuizCount: 0,
      },
    };
  }

  const base = {
    lessonId: lesson.id,
    requiredQuizId: lesson.requiredQuizId,
    nextLessonId: null as string | null,
    prerequisites: {
      previousLessonCompleted: true,
      requiredQuizCount: 0,
      completedRequiredQuizCount: 0,
    },
  };

  if (!ctx.enrolled) {
    return {
      ...base,
      accessStatus: "LOCKED",
      isUnlocked: false,
      lockReason: "ENROLLMENT_REQUIRED",
      progressStatus: progressStatusFor(lesson.id, ctx.completedLessonIds),
    };
  }

  const alreadyCompleted = ctx.completedLessonIds.has(lesson.id);
  const progressStatus = progressStatusFor(lesson.id, ctx.completedLessonIds);

  if (lessonIndex === 0 || alreadyCompleted) {
    return {
      ...base,
      accessStatus: "UNLOCKED",
      isUnlocked: true,
      lockReason: null,
      progressStatus,
      nextLessonId: resolveNextLessonId(lessonIndex, ctx),
    };
  }

  const previous = ctx.lessons[lessonIndex - 1];
  if (!previous) {
    return {
      ...base,
      accessStatus: "LOCKED",
      isUnlocked: false,
      lockReason: "LESSON_UNAVAILABLE",
      progressStatus,
    };
  }
  const previousCompleted = ctx.completedLessonIds.has(previous.id);
  base.prerequisites.previousLessonCompleted = previousCompleted;

  if (!previousCompleted) {
    return {
      ...base,
      accessStatus: "LOCKED",
      isUnlocked: false,
      lockReason: "PREVIOUS_LESSON_NOT_COMPLETED",
      progressStatus,
    };
  }

  if (previous.requiredQuizId) {
    base.prerequisites.requiredQuizCount = 1;
    const quizEval = evaluateQuizRequirement(previous.requiredQuizId, ctx);
    if (quizEval.satisfied) {
      base.prerequisites.completedRequiredQuizCount = 1;
    } else {
      return {
        ...base,
        accessStatus: "LOCKED",
        isUnlocked: false,
        lockReason: quizEval.lockReason ?? "REQUIRED_QUIZ_NOT_COMPLETED",
        progressStatus,
      };
    }
  }

  return {
    ...base,
    accessStatus: "UNLOCKED",
    isUnlocked: true,
    lockReason: null,
    progressStatus,
    nextLessonId: resolveNextLessonId(lessonIndex, ctx),
  };
}

/** Next lesson is exposed only when current lesson is complete and any gate quiz is satisfied. */
function resolveNextLessonId(
  lessonIndex: number,
  ctx: ChapterProgressionContext,
): string | null {
  const lesson = ctx.lessons[lessonIndex];
  const next = ctx.lessons[lessonIndex + 1];
  if (!lesson || !next) return null;

  if (!ctx.completedLessonIds.has(lesson.id)) return null;

  if (lesson.requiredQuizId) {
    const evalResult = evaluateQuizRequirement(lesson.requiredQuizId, ctx);
    if (!evalResult.satisfied) return null;
  }

  return next.id;
}

export function evaluateChapterLessons(
  ctx: ChapterProgressionContext,
): LessonAccessEvaluation[] {
  return ctx.lessons.map((_, index) => evaluateLessonAccess(index, ctx));
}

export function assertLessonUnlocked(
  evaluation: LessonAccessEvaluation,
  meta?: { studentId?: string; chapterId?: string },
): void {
  if (evaluation.isUnlocked) return;

  logger.info("lesson_access_denied", {
    studentId: meta?.studentId,
    chapterId: meta?.chapterId,
    lessonId: evaluation.lessonId,
    lockReason: evaluation.lockReason,
    safeReasonCode: evaluation.lockReason,
  });

  throw new AppError(
    "Lesson is locked",
    403,
    evaluation.lockReason ?? "LESSON_UNAVAILABLE",
  );
}

export function canStartProgressionQuiz(
  quizId: string,
  gateLessonId: string | null,
  ctx: ChapterProgressionContext,
): { allowed: boolean; code?: string } {
  if (!gateLessonId) {
    return { allowed: true };
  }

  if (!ctx.completedLessonIds.has(gateLessonId)) {
    return { allowed: false, code: "QUIZ_PREREQUISITE_LESSON_INCOMPLETE" };
  }

  return { allowed: true };
}

/** Find the lesson that lists this quiz as its required progression gate. */
export function findGateLessonForQuiz(
  quizId: string,
  lessons: ProgressionLessonRow[],
): string | null {
  const match = lessons.find((l) => l.requiredQuizId === quizId);
  return match?.id ?? null;
}
