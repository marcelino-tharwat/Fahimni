import { describe, it, expect } from "vitest";
import { generateQuizSchema } from "./generate-quiz.dto.js";

const CHAP_A = "11111111-1111-4111-8111-111111111111";
const CHAP_B = "aaaaaaaa-1111-4111-8111-111111111111";
const L_A1 = "22222222-2222-4222-8222-222222222222";
const L_A2 = "33333333-3333-4333-8333-333333333333";

const base = {
  types: ["MCQ"],
  difficultyMode: "SINGLE" as const,
  difficulty: "medium" as const,
};

describe("generateQuizSchema — allocation", () => {
  it("accepts a legacy chapterId-only (implicit AUTO) request", () => {
    const parsed = generateQuizSchema.safeParse({
      chapterId: CHAP_A,
      contentScope: "CHAPTER",
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts SINGLE_CHAPTER BY_LESSON when lesson allocations sum to total", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [L_A1, L_A2],
      lessonAllocations: [
        { lessonId: L_A1, questionCount: 4 },
        { lessonId: L_A2, questionCount: 6 },
      ],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects BY_LESSON when lesson allocations do not sum to total", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [L_A1, L_A2],
      lessonAllocations: [
        { lessonId: L_A1, questionCount: 4 },
        { lessonId: L_A2, questionCount: 5 },
      ],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a zero / negative allocation count", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [L_A1],
      lessonAllocations: [{ lessonId: L_A1, questionCount: 0 }],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts MULTI_CHAPTER BY_CHAPTER when chapter allocations sum to total", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      chapterAllocations: [
        { chapterId: CHAP_A, questionCount: 3 },
        { chapterId: CHAP_B, questionCount: 4 },
      ],
      questionCount: 7,
      ...base,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects BY_CHAPTER without a per-chapter questionCount", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      chapterAllocations: [
        { chapterId: CHAP_A },
        { chapterId: CHAP_B, questionCount: 4 },
      ],
      questionCount: 7,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects BY_CHAPTER on a SINGLE_CHAPTER source", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterId: CHAP_A,
      contentScope: "CHAPTER",
      chapterAllocations: [{ chapterId: CHAP_A, questionCount: 10 }],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-AUTO allocation for FULL_CURRICULUM", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "FULL_CURRICULUM",
      allocationMode: "BY_CHAPTER",
      stageId: CHAP_A,
      contentScope: "CHAPTER",
      chapterAllocations: [{ chapterId: CHAP_A, questionCount: 10 }],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects AUTO that smuggles allocations", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "AUTO",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [L_A1],
      lessonAllocations: [{ lessonId: L_A1, questionCount: 10 }],
      questionCount: 10,
      ...base,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts MULTI_CHAPTER BY_LESSON with nested lesson allocations", () => {
    const parsed = generateQuizSchema.safeParse({
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      chapterAllocations: [
        { chapterId: CHAP_A, lessonAllocations: [{ lessonId: L_A1, questionCount: 2 }] },
        { chapterId: CHAP_B, lessonAllocations: [{ lessonId: L_A2, questionCount: 3 }] },
      ],
      questionCount: 5,
      ...base,
    });
    expect(parsed.success).toBe(true);
  });
});
