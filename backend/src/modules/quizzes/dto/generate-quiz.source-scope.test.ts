import { describe, it, expect } from "vitest";
import { generateQuizSchema } from "./generate-quiz.dto.js";

const CH1 = "11111111-1111-4111-8111-111111111111";
const CH2 = "22222222-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";

const common = {
  contentScope: "CHAPTER" as const,
  lessonIds: [] as string[],
  questionCount: 5,
  types: ["MCQ"] as const,
  difficultyMode: "SINGLE" as const,
  difficulty: "easy" as const,
};

describe("generateQuizSchema — source scope (additive, backward-compatible)", () => {
  it("accepts a legacy chapterId-only request (no sourceScope) as SINGLE_CHAPTER", () => {
    const r = generateQuizSchema.safeParse({ chapterId: CH1, ...common });
    expect(r.success).toBe(true);
  });

  it("accepts an explicit SINGLE_CHAPTER request", () => {
    const r = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      chapterId: CH1,
      ...common,
    });
    expect(r.success).toBe(true);
  });

  it("rejects SINGLE_CHAPTER without a chapterId", () => {
    const r = generateQuizSchema.safeParse({ sourceScope: "SINGLE_CHAPTER", ...common });
    expect(r.success).toBe(false);
  });

  it("accepts MULTI_CHAPTER with two chapters", () => {
    const r = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      chapterIds: [CH1, CH2],
      ...common,
    });
    expect(r.success).toBe(true);
  });

  it("rejects MULTI_CHAPTER with a single chapter", () => {
    const r = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      chapterIds: [CH1],
      ...common,
    });
    expect(r.success).toBe(false);
  });

  it("rejects MULTI_CHAPTER combined with SELECTED_LESSONS content scope", () => {
    const r = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      chapterIds: [CH1, CH2],
      ...common,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [CH1],
    });
    expect(r.success).toBe(false);
  });

  it("accepts FULL_CURRICULUM with a stageId", () => {
    const r = generateQuizSchema.safeParse({
      sourceScope: "FULL_CURRICULUM",
      stageId: STAGE,
      ...common,
    });
    expect(r.success).toBe(true);
  });

  it("rejects FULL_CURRICULUM without a stageId", () => {
    const r = generateQuizSchema.safeParse({ sourceScope: "FULL_CURRICULUM", ...common });
    expect(r.success).toBe(false);
  });
});
