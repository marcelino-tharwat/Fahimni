import {
  effectivePassingScore,
  scorePercentage,
} from "../progression/lesson-progression.js";

export type QuizDisplayStatus = "new" | "passed" | "failed" | "pending";

export interface AttemptDisplayInput {
  status: string;
  score: number | null;
  totalPoints: number;
}

export interface QuizDisplayResult {
  status: QuizDisplayStatus;
  score?: number;
  retakeAllowed?: boolean;
}

/**
 * Shared pass/fail display logic for student quiz list and related surfaces.
 * Aligns with progression `evaluateQuizRequirement` when attempt is GRADED.
 */
export function deriveQuizDisplayStatus(
  attempt: AttemptDisplayInput | undefined,
  passingScore: number | null,
): QuizDisplayResult {
  if (!attempt) {
    return { status: "new" };
  }

  if (attempt.status === "IN_PROGRESS" || attempt.status === "COMPLETED") {
    return { status: "pending" };
  }

  if (attempt.status === "GRADED") {
    const pct = scorePercentage(attempt.score, attempt.totalPoints);
    const rounded = Math.round(pct);
    const threshold = effectivePassingScore({ id: "", status: "PUBLISHED", passingScore });

    if (threshold === null) {
      return { status: "passed", score: rounded };
    }

    if (pct >= threshold) {
      return { status: "passed", score: rounded };
    }

    return { status: "failed", score: rounded, retakeAllowed: true };
  }

  return { status: "pending" };
}
