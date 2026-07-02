import type { QuestionResult } from "./auto-grade.js";

export type EssayGradingStatus = "PENDING" | "PARTIALLY_GRADED" | "GRADED";

/** Server-side essay grading status — `awardedPoints === null` means not graded. */
export function deriveEssayGradingStatus(
  essayResults: Pick<QuestionResult, "type" | "awardedPoints">[],
): EssayGradingStatus {
  const essays = essayResults.filter((r) => r.type === "ESSAY");
  if (essays.length === 0) return "GRADED";
  const gradedCount = essays.filter((r) => r.awardedPoints !== null).length;
  if (gradedCount === 0) return "PENDING";
  if (gradedCount < essays.length) return "PARTIALLY_GRADED";
  return "GRADED";
}

export function essayResultsFromStored(
  stored: QuestionResult[] | undefined,
): QuestionResult[] {
  return (stored ?? []).filter((r) => r.type === "ESSAY");
}

export function essayScoreSummary(essayResults: QuestionResult[]): {
  earnedEssayScore: number | null;
  maximumEssayScore: number;
  gradedEssayQuestionCount: number;
  essayQuestionCount: number;
} {
  const essayQuestionCount = essayResults.length;
  const graded = essayResults.filter((r) => r.awardedPoints !== null);
  const gradedEssayQuestionCount = graded.length;
  const maximumEssayScore = essayResults.reduce((s, r) => s + r.maxPoints, 0);
  const earnedEssayScore =
    gradedEssayQuestionCount === 0
      ? null
      : graded.reduce((s, r) => s + (r.awardedPoints ?? 0), 0);
  return {
    earnedEssayScore,
    maximumEssayScore,
    gradedEssayQuestionCount,
    essayQuestionCount,
  };
}

export function countStatuses(statuses: EssayGradingStatus[]): {
  pendingCount: number;
  partiallyGradedCount: number;
  gradedCount: number;
} {
  let pendingCount = 0;
  let partiallyGradedCount = 0;
  let gradedCount = 0;
  for (const s of statuses) {
    if (s === "PENDING") pendingCount += 1;
    else if (s === "PARTIALLY_GRADED") partiallyGradedCount += 1;
    else gradedCount += 1;
  }
  return { pendingCount, partiallyGradedCount, gradedCount };
}
