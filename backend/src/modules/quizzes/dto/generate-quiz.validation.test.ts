import { describe, it, expect } from "vitest";
import {
  generateQuizSchema,
  MAX_QUESTION_COUNT,
  MAX_TOPIC_FOCUS_LENGTH,
} from "./generate-quiz.dto.js";

const CHAPTER_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_1 = "22222222-2222-4222-8222-222222222222";
const LESSON_2 = "33333333-3333-4333-8333-333333333333";

function base(overrides: Record<string, unknown> = {}) {
  return {
    chapterId: CHAPTER_ID,
    contentScope: "CHAPTER",
    lessonIds: [],
    questionCount: 10,
    types: ["MCQ", "TF", "ESSAY"],
    difficultyMode: "SINGLE",
    difficulty: "medium",
    ...overrides,
  };
}

function mixedBase(overrides: Record<string, unknown> = {}) {
  const { difficulty: _removed, ...rest } = base();
  return {
    ...rest,
    difficultyMode: "MIXED",
    difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
    ...overrides,
  };
}

describe("generateQuizSchema", () => {
  it("accepts a valid CHAPTER scope request", () => {
    const result = generateQuizSchema.safeParse(base());
    expect(result.success).toBe(true);
  });

  it("accepts a valid SELECTED_LESSONS request", () => {
    const result = generateQuizSchema.safeParse({
      chapterId: CHAPTER_ID,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [LESSON_1, LESSON_2],
      questionCount: 8,
      types: ["MCQ", "TF"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
      topicFocus: "اختبار المفاهيم الأساسية",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid MIXED mode without single difficulty", () => {
    const result = generateQuizSchema.safeParse(mixedBase());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("difficulty");
    }
  });

  it("rejects MIXED mode without distribution", () => {
    const result = generateQuizSchema.safeParse(
      mixedBase({ difficultyDistribution: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects MIXED mode with contradictory single difficulty", () => {
    const result = generateQuizSchema.safeParse(
      mixedBase({ difficulty: "easy" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects SINGLE mode with contradictory distribution", () => {
    const result = generateQuizSchema.safeParse(
      base({
        difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects SINGLE mode without difficulty", () => {
    const result = generateQuizSchema.safeParse(
      base({ difficulty: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects mixed totals below 100", () => {
    const result = generateQuizSchema.safeParse(
      mixedBase({
        difficultyDistribution: { easy: 20, medium: 30, hard: 40 },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects CHAPTER scope with lessonIds", () => {
    const result = generateQuizSchema.safeParse(
      base({ lessonIds: [LESSON_1] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects SELECTED_LESSONS without lessonIds", () => {
    const result = generateQuizSchema.safeParse(
      base({ contentScope: "SELECTED_LESSONS", lessonIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate lessonIds", () => {
    const result = generateQuizSchema.safeParse({
      chapterId: CHAPTER_ID,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [LESSON_1, LESSON_1],
      questionCount: 5,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid chapterId UUID", () => {
    const result = generateQuizSchema.safeParse(base({ chapterId: "not-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejects questionCount of zero", () => {
    const result = generateQuizSchema.safeParse(base({ questionCount: 0 }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative questionCount", () => {
    const result = generateQuizSchema.safeParse(base({ questionCount: -3 }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer questionCount", () => {
    const result = generateQuizSchema.safeParse(base({ questionCount: 3.5 }));
    expect(result.success).toBe(false);
  });

  it("rejects an excessive questionCount", () => {
    const result = generateQuizSchema.safeParse(
      base({ questionCount: MAX_QUESTION_COUNT + 1 }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty types array", () => {
    const result = generateQuizSchema.safeParse(base({ types: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported question type", () => {
    const result = generateQuizSchema.safeParse(
      base({ types: ["MCQ", "FILL_BLANK"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate types", () => {
    const result = generateQuizSchema.safeParse(base({ types: ["MCQ", "MCQ"] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid difficulty", () => {
    const result = generateQuizSchema.safeParse(
      base({ difficulty: "extreme" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only topicFocus", () => {
    const result = generateQuizSchema.safeParse(base({ topicFocus: "   " }));
    expect(result.success).toBe(false);
  });

  it("trims topicFocus", () => {
    const result = generateQuizSchema.safeParse(
      base({ topicFocus: "  المعادلات  " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topicFocus).toBe("المعادلات");
    }
  });

  it("rejects a topicFocus over the max length", () => {
    const result = generateQuizSchema.safeParse(
      base({ topicFocus: "x".repeat(MAX_TOPIC_FOCUS_LENGTH + 1) }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects when questionCount is smaller than the number of unique types", () => {
    const result = generateQuizSchema.safeParse(
      base({ questionCount: 2, types: ["MCQ", "TF", "ESSAY"] }),
    );
    expect(result.success).toBe(false);
  });
});
