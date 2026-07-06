import type { QuestionResult } from "./auto-grade.js";

/** A parsed, clamped AI suggestion for one essay answer. */
export interface EssaySuggestion {
  suggestedScore: number;
  feedback: string;
}

const MAX_AI_FEEDBACK_LENGTH = 2000;

/**
 * Parse the model's raw text into a validated suggestion, clamped to
 * [0, maxPoints]. Tolerant of code fences and surrounding prose. Throws on
 * unusable output so the caller can degrade to "AI unavailable" for that essay.
 */
export function parseEssaySuggestion(raw: string, maxPoints: number): EssaySuggestion {
  const text = stripCodeFences(raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Essay grading response did not contain JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Essay grading response was not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Essay grading response was not an object");
  }
  const obj = parsed as Record<string, unknown>;

  const rawScore = obj.suggestedScore;
  const score =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string"
        ? Number(rawScore)
        : NaN;
  if (!Number.isFinite(score)) {
    throw new Error("Essay grading response had no numeric suggestedScore");
  }

  const feedback =
    typeof obj.feedback === "string" ? obj.feedback.trim().slice(0, MAX_AI_FEEDBACK_LENGTH) : "";

  return { suggestedScore: clampScore(score, maxPoints), feedback };
}

/** Clamp a raw score to an integer-safe value within [0, maxPoints]. */
export function clampScore(score: number, maxPoints: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.max(0, Math.min(maxPoints, score));
  // Keep at most 2 decimals to avoid float noise; teachers usually award whole
  // marks but half-marks should survive.
  return Math.round(clamped * 100) / 100;
}

function stripCodeFences(s: string): string {
  return s
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

/** Review status derived from a stored essay result (for teacher display). */
export type EssayReviewStatus =
  | "NOT_REQUIRED"
  | "AI_SUGGESTED"
  | "PENDING_REVIEW"
  | "APPROVED";

/**
 * Derive a per-essay review status from its stored result. Pure and additive:
 * old results (no AI fields) simply map to PENDING_REVIEW while ungraded.
 */
export function deriveReviewStatus(
  r: Pick<QuestionResult, "type" | "awardedPoints" | "aiSuggestedAt">,
): EssayReviewStatus {
  if (r.type !== "ESSAY") return "NOT_REQUIRED";
  if (r.awardedPoints !== null && r.awardedPoints !== undefined) return "APPROVED";
  if (r.aiSuggestedAt) return "AI_SUGGESTED";
  return "PENDING_REVIEW";
}
