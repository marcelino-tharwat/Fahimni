import type { QuestionType } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { normalizeTfAnswer } from "./quiz-generation.mapping.js";

export type ResultStatus = "correct" | "incorrect" | "pending" | "graded";

export interface GradableQuestion {
  id: string;
  type: QuestionType;
  options: unknown;
  correctAnswer: string | null;
  points: number;
  sortOrder: number;
}

export interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export interface QuestionResult {
  questionId: string;
  type: QuestionType;
  answer: string;
  result: ResultStatus;
  awardedPoints: number | null;
  maxPoints: number;
  feedback: string | null;
  // ── Essay AI-suggestion + review metadata (all optional, additive) ────────
  // Stored inside the attempt `answers` JSON. Old stored results simply lack
  // these keys and are treated as "no suggestion / not reviewed". The AI
  // suggestion is advisory only — it NEVER sets awardedPoints, so an essay stays
  // `pending` (and the attempt stays COMPLETED, gating progression) until a
  // teacher approves it through the existing gradeEssays path.
  aiSuggestedPoints?: number | null;
  aiSuggestedFeedback?: string | null;
  aiSuggestedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
}

export interface GradeOutcome {
  results: QuestionResult[];
  score: number;
  totalPoints: number;
  percentage: number;
  pendingEssayCount: number;
  isFinal: boolean;
}

/** Normalize a Json `options` value into a string[] (MCQ/TF). */
export function optionsToArray(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((o) => String(o));
  }
  if (options && typeof options === "object") {
    return Object.values(options as Record<string, unknown>).map((o) => String(o));
  }
  return [];
}

export function roundPercentage(score: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0;
  return Math.round((score / totalPoints) * 100 * 100) / 100;
}

/**
 * Validates a single answer's *format* for its question type. Throws
 * AppError(400) on an unsupported value. Does not grade.
 */
export function validateAnswerFormat(
  question: GradableQuestion,
  answer: string,
): void {
  if (question.type === "MCQ") {
    const opts = optionsToArray(question.options).map((o) => o.trim());
    if (!opts.includes(answer.trim())) {
      throw new AppError(
        "Submitted answer is not one of the question options",
        400,
      );
    }
    return;
  }
  if (question.type === "TRUE_FALSE") {
    if (normalizeTfAnswer(answer) === null) {
      throw new AppError("Invalid true/false answer", 400);
    }
    return;
  }
  // ESSAY: non-empty text (already trimmed upstream).
  if (answer.trim().length === 0) {
    throw new AppError("Essay answer must not be empty", 400);
  }
}

/**
 * Auto-grades a full set of submitted answers against the quiz questions.
 *
 * - MCQ: exact normalized match → full points, else 0.
 * - TRUE_FALSE: normalized match → full points, else 0.
 * - ESSAY: pending (awardedPoints = null), not auto-graded.
 *
 * Pure: never mutates its inputs; results are ordered by question `sortOrder`.
 */
export function gradeAttempt(
  questions: GradableQuestion[],
  answersByQuestionId: Map<string, string>,
): GradeOutcome {
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);

  const results: QuestionResult[] = ordered.map((q) => {
    const raw = answersByQuestionId.get(q.id) ?? "";
    const answer = raw.trim();

    if (q.type === "ESSAY") {
      return {
        questionId: q.id,
        type: q.type,
        answer,
        result: "pending",
        awardedPoints: null,
        maxPoints: q.points,
        feedback: null,
      };
    }

    let correct = false;
    if (q.type === "TRUE_FALSE") {
      const submitted = normalizeTfAnswer(answer);
      const expected = normalizeTfAnswer(q.correctAnswer);
      correct = submitted !== null && expected !== null && submitted === expected;
    } else {
      // MCQ — exact normalized comparison, no fuzzy matching.
      correct = q.correctAnswer != null && answer === q.correctAnswer.trim();
    }

    return {
      questionId: q.id,
      type: q.type,
      answer,
      result: correct ? "correct" : "incorrect",
      awardedPoints: correct ? q.points : 0,
      maxPoints: q.points,
      feedback: null,
    };
  });

  return finalizeOutcome(results);
}

/** Recompute score/percentage/pending/isFinal from a results array. */
export function finalizeOutcome(results: QuestionResult[]): GradeOutcome {
  const totalPoints = results.reduce((s, r) => s + r.maxPoints, 0);
  const score = results.reduce((s, r) => s + (r.awardedPoints ?? 0), 0);
  const pendingEssayCount = results.filter((r) => r.result === "pending").length;
  return {
    results,
    score,
    totalPoints,
    percentage: roundPercentage(score, totalPoints),
    pendingEssayCount,
    isFinal: pendingEssayCount === 0,
  };
}
