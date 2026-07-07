import { describe, it, expect } from "vitest";
import {
  addQuestionSchema,
  updateQuestionSchema,
  MAX_QUESTION_POINTS,
} from "./quizzes.validation.js";

const baseAdd = {
  type: "MCQ" as const,
  content: "ما حل المعادلة؟",
  options: { "1": "أ", "2": "ب" },
  correctAnswer: "أ",
};

describe("question points validation", () => {
  it("accepts a valid integer points value on create", () => {
    const parsed = addQuestionSchema.parse({ ...baseAdd, points: 3 });
    expect(parsed.points).toBe(3);
  });

  it("allows omitting points on create (service applies a default)", () => {
    const parsed = addQuestionSchema.parse(baseAdd);
    expect(parsed.points).toBeUndefined();
  });

  it("rejects zero / negative points", () => {
    expect(addQuestionSchema.safeParse({ ...baseAdd, points: 0 }).success).toBe(false);
    expect(addQuestionSchema.safeParse({ ...baseAdd, points: -2 }).success).toBe(false);
  });

  it("rejects decimal points (Int column)", () => {
    expect(addQuestionSchema.safeParse({ ...baseAdd, points: 2.5 }).success).toBe(false);
  });

  it("rejects points above the max", () => {
    expect(
      addQuestionSchema.safeParse({ ...baseAdd, points: MAX_QUESTION_POINTS + 1 }).success,
    ).toBe(false);
    expect(
      addQuestionSchema.safeParse({ ...baseAdd, points: MAX_QUESTION_POINTS }).success,
    ).toBe(true);
  });

  it("accepts a points-only update (edit one question independently)", () => {
    const parsed = updateQuestionSchema.parse({ points: 10 });
    expect(parsed.points).toBe(10);
  });

  it("rejects an invalid points-only update", () => {
    expect(updateQuestionSchema.safeParse({ points: 0 }).success).toBe(false);
    expect(updateQuestionSchema.safeParse({ points: 1000 }).success).toBe(false);
  });
});
