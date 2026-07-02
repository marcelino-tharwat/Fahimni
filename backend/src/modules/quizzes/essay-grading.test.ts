import { describe, expect, it } from "vitest";
import {
  countStatuses,
  deriveEssayGradingStatus,
  essayScoreSummary,
} from "./essay-grading.js";
import type { QuestionResult } from "./auto-grade.js";

function essay(
  awardedPoints: number | null,
  maxPoints = 5,
): Pick<QuestionResult, "type" | "awardedPoints" | "maxPoints"> {
  return { type: "ESSAY", awardedPoints, maxPoints };
}

describe("deriveEssayGradingStatus", () => {
  it("returns PENDING when no essay is graded", () => {
    expect(deriveEssayGradingStatus([essay(null), essay(null)])).toBe("PENDING");
  });

  it("returns PARTIALLY_GRADED when some essays are graded", () => {
    expect(deriveEssayGradingStatus([essay(3), essay(null)])).toBe(
      "PARTIALLY_GRADED",
    );
  });

  it("returns GRADED when all essays are graded", () => {
    expect(deriveEssayGradingStatus([essay(0), essay(4)])).toBe("GRADED");
  });

  it("treats zero as graded", () => {
    expect(deriveEssayGradingStatus([essay(0)])).toBe("GRADED");
  });
});

describe("essayScoreSummary", () => {
  it("returns null earned score when nothing graded", () => {
    const r = essayScoreSummary([
      { type: "ESSAY", awardedPoints: null, maxPoints: 5 } as QuestionResult,
    ]);
    expect(r.earnedEssayScore).toBeNull();
    expect(r.gradedEssayQuestionCount).toBe(0);
  });

  it("sums graded essay points including zero", () => {
    const r = essayScoreSummary([
      { type: "ESSAY", awardedPoints: 0, maxPoints: 5 } as QuestionResult,
      { type: "ESSAY", awardedPoints: 3, maxPoints: 5 } as QuestionResult,
    ]);
    expect(r.earnedEssayScore).toBe(3);
    expect(r.gradedEssayQuestionCount).toBe(2);
    expect(r.maximumEssayScore).toBe(10);
  });
});

describe("countStatuses", () => {
  it("counts all status buckets", () => {
    expect(
      countStatuses(["PENDING", "PARTIALLY_GRADED", "GRADED", "PENDING"]),
    ).toEqual({ pendingCount: 2, partiallyGradedCount: 1, gradedCount: 1 });
  });
});
