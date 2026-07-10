import { prisma } from "../../config/database.js";
import {
  deriveQuizDisplayStatus,
} from "./quiz-attempt-display.js";
import {
  evaluateQuizRequirement,
  pickProgressionAttempt,
  type ProgressionAttemptRow,
  type ProgressionQuizRow,
} from "../progression/lesson-progression.js";

/**
 * ── Unified student quiz eligibility ─────────────────────────────────────────
 *
 * Central policy that decides, for every quiz a student can see, whether they
 * may actually TAKE it. My Quizzes, the lesson/chapter surfaces, and the quiz
 * attempt-start endpoint all consume this same computation so the "visible but
 * locked" behaviour is consistent and cannot be bypassed by calling the API
 * directly.
 *
 * Quiz classification (per chapter):
 *  - GATE quiz     — a quiz referenced by some Lesson.requiredQuizId. Its unlock
 *                    is governed by the EXISTING progression gate (the gate
 *                    lesson must be completed). Treated here as a LESSON quiz
 *                    whose required lesson is the gate lesson. It is never given
 *                    a new previous-quiz dependency (existing behaviour wins).
 *  - LESSON quiz   — contentScope = SELECTED_LESSONS with ≥1 linked lesson (and
 *                    not a gate quiz). Unlocks only when ALL its linked lessons
 *                    are completed.
 *  - CHAPTER quiz  — contentScope = CHAPTER (and not a gate quiz). Appears at the
 *                    end of the chapter; unlocks only when ALL lessons in the
 *                    chapter are completed.
 *
 * Previous-quiz dependency (documented policy):
 *  - Non-gate LESSON quizzes form an ordered chain by their linked lesson's
 *    sortOrder (then createdAt, id). Each depends on the previous lesson quiz.
 *  - Each CHAPTER quiz depends on the LAST non-gate lesson quiz in the chapter
 *    (chapter quizzes are peers, they do NOT chain to one another).
 *  - GATE quizzes carry no new previous-quiz dependency.
 *
 * "Completed" for the previous-quiz dependency reuses the existing
 * `evaluateQuizRequirement` policy: an attempt is GRADED and (no passingScore ⇒
 * any graded attempt, otherwise score% ≥ passingScore).
 */

export const QUIZ_LOCK_REASON_CODES = [
  "LESSON_NOT_COMPLETED",
  "CHAPTER_LESSONS_NOT_COMPLETED",
  "PREVIOUS_QUIZ_NOT_COMPLETED",
  "ENROLLMENT_REQUIRED",
  "QUIZ_NOT_PUBLISHED",
  "ATTEMPT_ALREADY_COMPLETED",
  "RETAKE_NOT_ALLOWED",
] as const;

export type QuizLockReasonCode = (typeof QUIZ_LOCK_REASON_CODES)[number];

export type QuizScope = "LESSON" | "CHAPTER";

/** Arabic, student-facing lock reasons. Mirrored on the frontend i18n bundle. */
export const QUIZ_LOCK_MESSAGES: Record<QuizLockReasonCode, string> = {
  LESSON_NOT_COMPLETED: "أكمل مشاهدة الدرس أولًا",
  CHAPTER_LESSONS_NOT_COMPLETED: "أكمل دروس الفصل أولًا",
  PREVIOUS_QUIZ_NOT_COMPLETED: "يجب إنهاء الكويز السابق أولًا",
  ENROLLMENT_REQUIRED: "يجب الاشتراك في هذا المحتوى أولًا",
  QUIZ_NOT_PUBLISHED: "هذا الاختبار غير متاح حاليًا",
  ATTEMPT_ALREADY_COMPLETED: "لقد أكملت هذا الاختبار بالفعل",
  RETAKE_NOT_ALLOWED: "لا يمكن إعادة هذه المحاولة",
};

export interface QuizAttemptEligibilityState {
  hasAttempt: boolean;
  latestStatus: string | null;
  canRetake: boolean;
  bestScore: number | null;
}

export interface QuizEligibility {
  id: string;
  quizScope: QuizScope;
  lessonId: string | null;
  order: number;
  isUnlocked: boolean;
  canTake: boolean;
  lockReason: string | null;
  lockReasonCode: QuizLockReasonCode | null;
  requiredLessonIds: string[];
  completedLessonIds: string[];
  previousQuizId: string | null;
  previousQuizCompleted: boolean;
  attemptState: QuizAttemptEligibilityState;
}

// ── Pure inputs ──────────────────────────────────────────────────────────────

export interface EligibilityQuizRow {
  id: string;
  contentScope: "CHAPTER" | "SELECTED_LESSONS";
  status: string;
  passingScore: number | null;
  createdAt: Date;
  /** Linked lesson ids (from QuizLesson), already restricted to this chapter. */
  linkedLessonIds: string[];
}

export interface EligibilityLessonRow {
  id: string;
  sortOrder: number;
  requiredQuizId: string | null;
}

export interface QuizPlacement {
  quizScope: QuizScope;
  isGate: boolean;
  /** Primary lesson for a LESSON quiz (min sortOrder linked / gate lesson). */
  primaryLessonId: string | null;
  requiredLessonIds: string[];
  order: number;
  previousQuizId: string | null;
}

function stableCreatedAt(a: EligibilityQuizRow, b: EligibilityQuizRow): number {
  const at = a.createdAt?.getTime?.() ?? 0;
  const bt = b.createdAt?.getTime?.() ?? 0;
  if (at !== bt) return at - bt;
  return a.id.localeCompare(b.id);
}

/**
 * Classify + order every quiz in a chapter and resolve each quiz's
 * previous-quiz dependency. Pure — deterministic given its inputs.
 */
export function classifyAndOrderQuizzes(
  quizzes: EligibilityQuizRow[],
  lessons: EligibilityLessonRow[],
): Map<string, QuizPlacement> {
  const lessonSortById = new Map(lessons.map((l) => [l.id, l.sortOrder]));
  const allChapterLessonIds = lessons.map((l) => l.id);
  // quizId -> gate lessonId (the lesson whose requiredQuizId === quizId)
  const gateLessonByQuizId = new Map<string, string>();
  for (const l of lessons) {
    if (l.requiredQuizId) gateLessonByQuizId.set(l.requiredQuizId, l.id);
  }

  const minLinkedSortOrder = (q: EligibilityQuizRow): number => {
    const orders = q.linkedLessonIds
      .map((id) => lessonSortById.get(id))
      .filter((n): n is number => n !== undefined);
    return orders.length > 0 ? Math.min(...orders) : Number.MAX_SAFE_INTEGER;
  };

  interface Classified {
    quiz: EligibilityQuizRow;
    quizScope: QuizScope;
    isGate: boolean;
    primaryLessonId: string | null;
    requiredLessonIds: string[];
    lessonSortKey: number;
  }

  const classified: Classified[] = quizzes.map((q) => {
    const gateLessonId = gateLessonByQuizId.get(q.id) ?? null;
    const isGate = gateLessonId !== null;

    if (isGate && gateLessonId) {
      const sortKey =
        lessonSortById.get(gateLessonId) ?? Number.MAX_SAFE_INTEGER;
      return {
        quiz: q,
        quizScope: "LESSON",
        isGate: true,
        primaryLessonId: gateLessonId,
        requiredLessonIds: [gateLessonId],
        lessonSortKey: sortKey,
      };
    }

    const linkedInChapter = q.linkedLessonIds.filter((id) =>
      lessonSortById.has(id),
    );
    if (q.contentScope === "SELECTED_LESSONS" && linkedInChapter.length > 0) {
      // Primary lesson = the linked lesson with the smallest sortOrder.
      const primary = [...linkedInChapter].sort(
        (a, b) =>
          (lessonSortById.get(a) ?? 0) - (lessonSortById.get(b) ?? 0),
      )[0]!;
      return {
        quiz: q,
        quizScope: "LESSON",
        isGate: false,
        primaryLessonId: primary,
        requiredLessonIds: linkedInChapter,
        lessonSortKey: minLinkedSortOrder(q),
      };
    }

    // Chapter-level quiz — requires every lesson in the chapter.
    return {
      quiz: q,
      quizScope: "CHAPTER",
      isGate: false,
      primaryLessonId: null,
      requiredLessonIds: allChapterLessonIds,
      lessonSortKey: Number.MAX_SAFE_INTEGER,
    };
  });

  const lessonQuizzes = classified
    .filter((c) => c.quizScope === "LESSON")
    .sort(
      (a, b) =>
        a.lessonSortKey - b.lessonSortKey || stableCreatedAt(a.quiz, b.quiz),
    );
  const chapterQuizzes = classified
    .filter((c) => c.quizScope === "CHAPTER")
    .sort((a, b) => stableCreatedAt(a.quiz, b.quiz));

  // Non-gate lesson quizzes form the ordered chain used for previous-quiz deps.
  const nonGateLessonQuizzes = lessonQuizzes.filter((c) => !c.isGate);
  const prevByLessonQuizId = new Map<string, string | null>();
  nonGateLessonQuizzes.forEach((c, i) => {
    prevByLessonQuizId.set(
      c.quiz.id,
      i > 0 ? nonGateLessonQuizzes[i - 1]!.quiz.id : null,
    );
  });
  const lastLessonQuizId =
    nonGateLessonQuizzes.length > 0
      ? nonGateLessonQuizzes[nonGateLessonQuizzes.length - 1]!.quiz.id
      : null;

  const ordered = [...lessonQuizzes, ...chapterQuizzes];
  const result = new Map<string, QuizPlacement>();
  ordered.forEach((c, index) => {
    let previousQuizId: string | null = null;
    if (c.quizScope === "CHAPTER") {
      previousQuizId = lastLessonQuizId;
    } else if (!c.isGate) {
      previousQuizId = prevByLessonQuizId.get(c.quiz.id) ?? null;
    } else {
      previousQuizId = null; // gate quizzes: existing progression only
    }
    result.set(c.quiz.id, {
      quizScope: c.quizScope,
      isGate: c.isGate,
      primaryLessonId: c.primaryLessonId,
      requiredLessonIds: c.requiredLessonIds,
      order: index + 1,
      previousQuizId,
    });
  });

  return result;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Compute eligibility for every PUBLISHED quiz in a chapter for one student.
 * Returns a map keyed by quizId. Chapters with no lessons yield vacuously
 * unlocked quizzes (no lesson gate applies).
 */
export async function computeChapterQuizEligibility(
  studentId: string,
  chapterId: string,
  chapterPrice: number | null,
): Promise<Map<string, QuizEligibility>> {
  const enrolled =
    chapterPrice === null ||
    chapterPrice <= 0 ||
    (await prisma.enrollment.findFirst({
      where: { studentId, chapterId, status: "ACTIVE" },
      select: { id: true },
    })) !== null;

  const [lessons, quizRows] = await Promise.all([
    prisma.lesson.findMany({
      where: { chapterId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true, requiredQuizId: true },
    }),
    prisma.quiz.findMany({
      where: { chapterId, status: "PUBLISHED" },
      select: {
        id: true,
        contentScope: true,
        status: true,
        passingScore: true,
        createdAt: true,
        quizLessons: { select: { lessonId: true } },
      },
    }),
  ]);

  const lessonIdSet = new Set(lessons.map((l) => l.id));
  const quizzes: EligibilityQuizRow[] = quizRows.map((q) => ({
    id: q.id,
    contentScope: q.contentScope,
    status: q.status,
    passingScore: q.passingScore,
    createdAt: q.createdAt,
    linkedLessonIds: q.quizLessons
      .map((ql) => ql.lessonId)
      .filter((id) => lessonIdSet.has(id)),
  }));

  const quizIds = quizzes.map((q) => q.id);
  const [progressRows, attemptRows] = await Promise.all([
    lessons.length > 0
      ? prisma.lessonProgress.findMany({
          where: {
            studentId,
            lessonId: { in: lessons.map((l) => l.id) },
            completed: true,
          },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    quizIds.length > 0
      ? prisma.quizAttempt.findMany({
          where: { studentId, quizId: { in: quizIds } },
          select: {
            quizId: true,
            status: true,
            score: true,
            totalPoints: true,
            completedAt: true,
            id: true,
          },
          orderBy: { completedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const completedLessonIds = new Set(progressRows.map((p) => p.lessonId));

  // Best/representative attempt per quiz (mirrors progression-context).
  const attemptsByQuiz = new Map<
    string,
    (ProgressionAttemptRow & { id: string })[]
  >();
  for (const row of attemptRows) {
    const bucket = attemptsByQuiz.get(row.quizId) ?? [];
    bucket.push(row as ProgressionAttemptRow & { id: string });
    attemptsByQuiz.set(row.quizId, bucket);
  }
  const pickedAttemptByQuiz = new Map<
    string,
    ProgressionAttemptRow & { id: string }
  >();
  for (const [quizId, rows] of attemptsByQuiz) {
    const picked = pickProgressionAttempt(rows) as
      | (ProgressionAttemptRow & { id: string })
      | undefined;
    if (picked) pickedAttemptByQuiz.set(quizId, picked);
  }

  // Maps for evaluateQuizRequirement (previous-quiz completion policy).
  const quizzesById = new Map<string, ProgressionQuizRow>(
    quizzes.map((q) => [
      q.id,
      { id: q.id, status: q.status, passingScore: q.passingScore },
    ]),
  );
  const attemptsByQuizId = new Map<string, ProgressionAttemptRow>(
    [...pickedAttemptByQuiz.entries()].map(([id, a]) => [id, a]),
  );

  const placements = classifyAndOrderQuizzes(quizzes, lessons);
  const passingById = new Map(quizzes.map((q) => [q.id, q.passingScore]));

  const isQuizCompleted = (quizId: string): boolean =>
    evaluateQuizRequirement(quizId, { quizzesById, attemptsByQuizId })
      .satisfied;

  const result = new Map<string, QuizEligibility>();
  for (const q of quizzes) {
    const placement = placements.get(q.id)!;
    const requiredLessonIds = placement.requiredLessonIds;
    const completedRequired = requiredLessonIds.filter((id) =>
      completedLessonIds.has(id),
    );
    const allLessonsDone = requiredLessonIds.every((id) =>
      completedLessonIds.has(id),
    );

    const previousQuizId = placement.previousQuizId;
    const previousQuizCompleted =
      previousQuizId === null ? true : isQuizCompleted(previousQuizId);

    // Gate reasons (drive isUnlocked).
    let lockReasonCode: QuizLockReasonCode | null = null;
    if (!enrolled) {
      lockReasonCode = "ENROLLMENT_REQUIRED";
    } else if (q.status !== "PUBLISHED") {
      lockReasonCode = "QUIZ_NOT_PUBLISHED";
    } else if (!allLessonsDone) {
      lockReasonCode =
        placement.quizScope === "CHAPTER"
          ? "CHAPTER_LESSONS_NOT_COMPLETED"
          : "LESSON_NOT_COMPLETED";
    } else if (!previousQuizCompleted) {
      lockReasonCode = "PREVIOUS_QUIZ_NOT_COMPLETED";
    }

    const isUnlocked = lockReasonCode === null;

    // Attempt state.
    const attempt = pickedAttemptByQuiz.get(q.id);
    const display = deriveQuizDisplayStatus(
      attempt
        ? {
            status: attempt.status,
            score: attempt.score,
            totalPoints: attempt.totalPoints,
          }
        : undefined,
      passingById.get(q.id) ?? null,
    );
    const attemptState: QuizAttemptEligibilityState = {
      hasAttempt: attempt !== undefined,
      latestStatus: attempt?.status ?? null,
      canRetake: display.retakeAllowed ?? false,
      bestScore: display.score ?? null,
    };

    // canTake: unlocked AND the attempt state permits a (re)start now.
    let canTake = isUnlocked;
    if (isUnlocked && attempt) {
      if (attempt.status === "IN_PROGRESS") {
        canTake = true;
      } else if (attempt.status === "COMPLETED") {
        canTake = false;
        lockReasonCode = "ATTEMPT_ALREADY_COMPLETED";
      } else if (attempt.status === "GRADED") {
        if (display.status === "passed") {
          canTake = false;
          lockReasonCode = "ATTEMPT_ALREADY_COMPLETED";
        } else if (display.status === "failed") {
          // Failed: retake follows the existing display policy.
          canTake = attemptState.canRetake;
          if (!canTake) lockReasonCode = "RETAKE_NOT_ALLOWED";
        }
      }
    }

    // lockReason surfaced to clients: gate reason when locked, else the
    // attempt-state reason (completed/retake). `isUnlocked` remains the single
    // signal the UI uses to disable the "Take Quiz" action.
    const effectiveLockCode = !isUnlocked ? lockReasonCode : null;

    result.set(q.id, {
      id: q.id,
      quizScope: placement.quizScope,
      lessonId: placement.primaryLessonId,
      order: placement.order,
      isUnlocked,
      canTake,
      lockReason: effectiveLockCode ? QUIZ_LOCK_MESSAGES[effectiveLockCode] : null,
      lockReasonCode: effectiveLockCode,
      requiredLessonIds,
      completedLessonIds: completedRequired,
      previousQuizId,
      previousQuizCompleted,
      attemptState,
    });
  }

  return result;
}
