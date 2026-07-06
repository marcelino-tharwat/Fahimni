import type { PendingEssayResultMode, QuestionType } from "../../generated/prisma/client.js";
import type { ResultStatus } from "./auto-grade.js";

/**
 * The per-question status a STUDENT is allowed to see. It is a superset of the
 * internal {@link ResultStatus}: when correctness is hidden the correctness-
 * revealing values ("correct" / "incorrect" / "graded") are replaced with the
 * neutral "answered" so the client can render the student's answer without any
 * right/wrong signal. "pending" is a grading-state (essay not yet graded), NOT
 * a correctness signal, so it is preserved.
 */
export type StudentResultStatus = ResultStatus | "answered";

/**
 * Centralized, backward-compatible policy for what a STUDENT is allowed to see
 * on the quiz result page. This is the single authority — the student result
 * endpoint enforces hiding HERE (server side); hidden fields are never sent over
 * the wire. Teacher/OPERATION result endpoints do NOT go through this policy and
 * always see full data.
 *
 * Backward compatibility contract:
 *   - A quiz with `resultSettingsConfigured === false` (every pre-existing quiz)
 *     is LEGACY: the full response is returned unchanged — same fields, same
 *     values as before this feature existed. Nothing is hidden.
 *   - Only when a teacher explicitly saves settings does the flag flip to true
 *     and the visibility rules below apply. Any individual null column resolves
 *     to a permissive default (show), so a teacher who toggles a single flag off
 *     does not accidentally hide everything else.
 */

/** Raw settings columns as read from the `quizzes` row. */
export interface QuizResultSettingsRow {
  resultSettingsConfigured: boolean;
  showCorrectAnswers: boolean | null;
  showPerQuestionScores: boolean | null;
  showFinalScore: boolean | null;
  showStudentAnswers: boolean | null;
  showExplanations: boolean | null;
  pendingEssayResultMode: PendingEssayResultMode | null;
}

/** Effective (null-resolved) visibility applied to a configured quiz. */
export interface EffectiveVisibility {
  configured: boolean;
  showCorrectAnswers: boolean;
  showPerQuestionScores: boolean;
  showFinalScore: boolean;
  showStudentAnswers: boolean;
  showExplanations: boolean;
  pendingEssayResultMode: PendingEssayResultMode;
}

export const DEFAULT_PENDING_ESSAY_RESULT_MODE: PendingEssayResultMode =
  "SHOW_OBJECTIVE_WITH_PENDING_MESSAGE";

/** Arabic student-facing messages (kept server-side so wording is authoritative). */
export const PENDING_MESSAGES = {
  hideAll: "سيتم إظهار النتيجة بعد مراجعة المدرس",
  objectiveOnly: "تم عرض نتائج الأسئلة الموضوعية فقط",
  objectiveWithPending: "النتيجة النهائية قيد المراجعة",
} as const;

/** Full (teacher-safe) per-question result entry — the pre-policy shape. */
export interface FullResultEntry {
  questionId: string;
  type: QuestionType;
  questionText: string;
  options: string[] | null;
  studentAnswer: string;
  correctAnswer: string | null;
  result: ResultStatus;
  awardedPoints: number | null;
  maxPoints: number;
  feedback?: string;
  explanation?: string;
}

/** Full (teacher-safe) submission response — the pre-policy shape. */
export interface FullSubmissionResult {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: string;
  score: number;
  totalPoints: number;
  percentage: number;
  pendingEssayCount: number;
  isFinal: boolean;
  results: FullResultEntry[];
}

/** Post-policy per-question entry — hidden fields are omitted entirely. */
export interface StudentVisibleEntry {
  questionId: string;
  type: QuestionType;
  questionText: string;
  options: string[] | null;
  // Neutralized to "answered" whenever per-question correctness is not allowed
  // (see resolveShowQuestionCorrectness) so no right/wrong signal is exposed.
  result: StudentResultStatus;
  studentAnswer?: string;
  correctAnswer?: string | null;
  awardedPoints?: number | null;
  maxPoints?: number;
  feedback?: string;
  explanation?: string;
}

/** Post-policy student response. Additive metadata lets the UI render safely. */
export interface StudentVisibleResult {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: string;
  score: number | null;
  totalPoints: number | null;
  percentage: number | null;
  pendingEssayCount: number;
  isFinal: boolean;
  hasPendingEssayReview: boolean;
  pendingEssayResultMode: PendingEssayResultMode | null;
  resultVisibility: EffectiveVisibility;
  message: string | null;
  results: StudentVisibleEntry[];
}

/** Resolve raw columns into effective visibility (permissive defaults). */
export function resolveEffectiveVisibility(
  settings: QuizResultSettingsRow,
): EffectiveVisibility {
  const configured = settings.resultSettingsConfigured === true;
  const on = (v: boolean | null): boolean => (v === null ? true : v);
  return {
    configured,
    showCorrectAnswers: on(settings.showCorrectAnswers),
    showPerQuestionScores: on(settings.showPerQuestionScores),
    showFinalScore: on(settings.showFinalScore),
    showStudentAnswers: on(settings.showStudentAnswers),
    showExplanations: on(settings.showExplanations),
    pendingEssayResultMode:
      settings.pendingEssayResultMode ?? DEFAULT_PENDING_ESSAY_RESULT_MODE,
  };
}

/**
 * Whether the student may see a per-question right/wrong signal. There is no
 * dedicated "show correctness" column, so correctness rides with the two
 * settings that inherently reveal it: the correct answer itself, or the
 * per-question score (0 vs full points ⇒ wrong vs right). If neither is
 * enabled, correctness stays hidden and `showStudentAnswers` only exposes the
 * student's own answer.
 */
export function resolveShowQuestionCorrectness(vis: EffectiveVisibility): boolean {
  return vis.showCorrectAnswers || vis.showPerQuestionScores;
}

/**
 * Project an internal grading status onto what the student may see.
 *   - correctness allowed  → status passes through unchanged.
 *   - correctness hidden    → "correct"/"incorrect"/"graded" collapse to the
 *                             neutral "answered"; "pending" is preserved (it is
 *                             a grading state, not a correctness signal).
 */
function projectResultStatus(
  status: ResultStatus,
  showCorrectness: boolean,
): StudentResultStatus {
  if (showCorrectness) return status;
  return status === "pending" ? "pending" : "answered";
}

/** Copy an entry, preserving optional feedback/explanation only when present. */
function fullEntryToVisible(e: FullResultEntry): StudentVisibleEntry {
  const out: StudentVisibleEntry = {
    questionId: e.questionId,
    type: e.type,
    questionText: e.questionText,
    options: e.options,
    result: e.result,
    studentAnswer: e.studentAnswer,
    correctAnswer: e.correctAnswer,
    awardedPoints: e.awardedPoints,
    maxPoints: e.maxPoints,
  };
  if (e.feedback !== undefined) out.feedback = e.feedback;
  if (e.explanation !== undefined) out.explanation = e.explanation;
  return out;
}

/**
 * Apply the student result-visibility policy. For LEGACY quizzes the response
 * is a faithful pass-through (nothing hidden). For configured quizzes, hidden
 * fields are removed from the payload entirely.
 */
export function applyStudentResultPolicy(
  full: FullSubmissionResult,
  settings: QuizResultSettingsRow,
): StudentVisibleResult {
  const vis = resolveEffectiveVisibility(settings);
  const hasPendingEssayReview = full.isFinal === false;

  // ── Legacy: faithful pass-through, nothing hidden ────────────────────────
  if (!vis.configured) {
    return {
      attemptId: full.attemptId,
      quizId: full.quizId,
      quizTitle: full.quizTitle,
      status: full.status,
      score: full.score,
      totalPoints: full.totalPoints,
      percentage: full.percentage,
      pendingEssayCount: full.pendingEssayCount,
      isFinal: full.isFinal,
      hasPendingEssayReview,
      pendingEssayResultMode: null,
      resultVisibility: vis,
      message: null,
      results: full.results.map(fullEntryToVisible),
    };
  }

  // ── Configured: determine which entries survive + the pending message ────
  let message: string | null = null;
  let entries = full.results;
  // While final score must be shown only when both allowed AND final.
  let showFinalScore = vis.showFinalScore;

  if (hasPendingEssayReview) {
    // Final score is provisional while essays are pending — never expose it.
    showFinalScore = false;
    switch (vis.pendingEssayResultMode) {
      case "HIDE_ALL_RESULTS":
        message = PENDING_MESSAGES.hideAll;
        entries = [];
        break;
      case "SHOW_OBJECTIVE_ONLY":
        message = PENDING_MESSAGES.objectiveOnly;
        entries = entries.filter((e) => e.type !== "ESSAY");
        break;
      case "SHOW_OBJECTIVE_WITH_PENDING_MESSAGE":
      default:
        message = PENDING_MESSAGES.objectiveWithPending;
        entries = entries.filter((e) => e.type !== "ESSAY");
        break;
    }
  }

  const showQuestionCorrectness = resolveShowQuestionCorrectness(vis);

  const results: StudentVisibleEntry[] = entries.map((e) => {
    const out: StudentVisibleEntry = {
      questionId: e.questionId,
      type: e.type,
      questionText: e.questionText,
      options: e.options,
      // Correctness is neutralized unless explicitly allowed — a visible
      // student answer must never carry a right/wrong signal on its own.
      result: projectResultStatus(e.result, showQuestionCorrectness),
    };
    if (vis.showStudentAnswers) out.studentAnswer = e.studentAnswer;
    if (vis.showCorrectAnswers) out.correctAnswer = e.correctAnswer;
    if (vis.showPerQuestionScores) {
      out.awardedPoints = e.awardedPoints;
      out.maxPoints = e.maxPoints;
    }
    if (vis.showExplanations && e.explanation !== undefined) {
      out.explanation = e.explanation;
    }
    // Teacher essay feedback follows the per-question-score visibility toggle,
    // since it is part of the graded per-question outcome.
    if (vis.showPerQuestionScores && e.feedback !== undefined) {
      out.feedback = e.feedback;
    }
    return out;
  });

  return {
    attemptId: full.attemptId,
    quizId: full.quizId,
    quizTitle: full.quizTitle,
    status: full.status,
    score: showFinalScore ? full.score : null,
    totalPoints: showFinalScore ? full.totalPoints : null,
    percentage: showFinalScore ? full.percentage : null,
    pendingEssayCount: full.pendingEssayCount,
    isFinal: full.isFinal,
    hasPendingEssayReview,
    pendingEssayResultMode: vis.pendingEssayResultMode,
    resultVisibility: vis,
    message,
    results,
  };
}
