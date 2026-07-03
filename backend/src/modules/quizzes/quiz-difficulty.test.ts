import { describe, it, expect } from "vitest";
import {
  allocateQuestionCounts,
  resolveQuizDifficulty,
  validateDifficultyDistribution,
} from "./quiz-difficulty.js";
import { AppError } from "../../shared/utils/AppError.js";

describe("validateDifficultyDistribution", () => {
  it("accepts a valid total of 100", () => {
    expect(() =>
      validateDifficultyDistribution({ easy: 20, medium: 30, hard: 50 }),
    ).not.toThrow();
  });

  it("rejects totals below 100", () => {
    expect(() =>
      validateDifficultyDistribution({ easy: 20, medium: 30, hard: 40 }),
    ).toThrow(AppError);
  });

  it("rejects negative values", () => {
    expect(() =>
      validateDifficultyDistribution({ easy: -1, medium: 50, hard: 51 }),
    ).toThrow(AppError);
  });
});

describe("allocateQuestionCounts", () => {
  it("allocates exactly 10 questions", () => {
    const counts = allocateQuestionCounts(
      { easy: 20, medium: 30, hard: 50 },
      10,
    );
    expect(counts.easy + counts.medium + counts.hard).toBe(10);
    expect(counts).toEqual({ easy: 2, medium: 3, hard: 5 });
  });

  it("allocates exactly 7 questions with awkward percentages", () => {
    const counts = allocateQuestionCounts(
      { easy: 33, medium: 34, hard: 33 },
      7,
    );
    expect(counts.easy + counts.medium + counts.hard).toBe(7);
  });

  it("allocates exactly 13 questions", () => {
    const counts = allocateQuestionCounts(
      { easy: 25, medium: 25, hard: 50 },
      13,
    );
    expect(counts.easy + counts.medium + counts.hard).toBe(13);
  });

  it("allocates zero for a zero-percent level", () => {
    const counts = allocateQuestionCounts(
      { easy: 0, medium: 40, hard: 60 },
      10,
    );
    expect(counts.easy).toBe(0);
    expect(counts.medium + counts.hard).toBe(10);
  });
});

describe("resolveQuizDifficulty", () => {
  it("resolves single mode", () => {
    const resolved = resolveQuizDifficulty({
      difficultyMode: "SINGLE",
      difficulty: "hard",
      questionCount: 5,
    });
    expect(resolved.difficultyMode).toBe("SINGLE");
    if (resolved.difficultyMode === "SINGLE") {
      expect(resolved.questionCounts).toEqual({ easy: 0, medium: 0, hard: 5 });
    }
  });

  it("resolves mixed mode without single difficulty", () => {
    const resolved = resolveQuizDifficulty({
      difficultyMode: "MIXED",
      difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
      questionCount: 10,
    });
    expect(resolved.difficultyMode).toBe("MIXED");
    if (resolved.difficultyMode === "MIXED") {
      expect(resolved.questionCounts.hard).toBe(5);
    }
  });

  it("rejects mixed mode with single difficulty field", () => {
    expect(() =>
      resolveQuizDifficulty({
        difficultyMode: "MIXED",
        difficulty: "easy",
        difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
        questionCount: 10,
      }),
    ).toThrow(AppError);
  });
});
