import { describe, it, expect } from "vitest";
import {
  parseEssaySuggestion,
  clampScore,
  deriveReviewStatus,
} from "./essay-ai-grading.js";

describe("parseEssaySuggestion", () => {
  it("parses a plain JSON object", () => {
    const s = parseEssaySuggestion('{"suggestedScore": 4, "feedback": "جيد"}', 5);
    expect(s.suggestedScore).toBe(4);
    expect(s.feedback).toBe("جيد");
  });

  it("tolerates code fences and surrounding prose", () => {
    const raw = 'حسناً\n```json\n{"suggestedScore": 3, "feedback": "ok"}\n```\n';
    const s = parseEssaySuggestion(raw, 5);
    expect(s.suggestedScore).toBe(3);
  });

  it("clamps an over-max score down to maxPoints", () => {
    const s = parseEssaySuggestion('{"suggestedScore": 99, "feedback": "x"}', 5);
    expect(s.suggestedScore).toBe(5);
  });

  it("clamps a negative score up to 0", () => {
    const s = parseEssaySuggestion('{"suggestedScore": -3, "feedback": "x"}', 5);
    expect(s.suggestedScore).toBe(0);
  });

  it("coerces a numeric string score", () => {
    const s = parseEssaySuggestion('{"suggestedScore": "2.5", "feedback": "x"}', 5);
    expect(s.suggestedScore).toBe(2.5);
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseEssaySuggestion("no json here", 5)).toThrow();
  });

  it("throws when suggestedScore is not numeric", () => {
    expect(() => parseEssaySuggestion('{"suggestedScore": "abc"}', 5)).toThrow();
  });
});

describe("clampScore", () => {
  it("clamps within [0, max]", () => {
    expect(clampScore(7, 5)).toBe(5);
    expect(clampScore(-1, 5)).toBe(0);
    expect(clampScore(3, 5)).toBe(3);
  });
  it("returns 0 for non-finite input", () => {
    expect(clampScore(NaN, 5)).toBe(0);
  });
});

describe("deriveReviewStatus", () => {
  it("returns NOT_REQUIRED for non-essay", () => {
    expect(deriveReviewStatus({ type: "MCQ", awardedPoints: 1, aiSuggestedAt: null })).toBe(
      "NOT_REQUIRED",
    );
  });
  it("returns APPROVED once awardedPoints is set", () => {
    expect(deriveReviewStatus({ type: "ESSAY", awardedPoints: 4, aiSuggestedAt: null })).toBe(
      "APPROVED",
    );
  });
  it("returns AI_SUGGESTED when a suggestion exists but not yet graded", () => {
    expect(
      deriveReviewStatus({ type: "ESSAY", awardedPoints: null, aiSuggestedAt: "2026-07-05T00:00:00Z" }),
    ).toBe("AI_SUGGESTED");
  });
  it("returns PENDING_REVIEW for an ungraded essay with no suggestion", () => {
    expect(deriveReviewStatus({ type: "ESSAY", awardedPoints: null, aiSuggestedAt: null })).toBe(
      "PENDING_REVIEW",
    );
  });
});
