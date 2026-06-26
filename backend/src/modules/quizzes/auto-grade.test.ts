import { describe, it, expect } from "vitest";
import {
  gradeAttempt,
  validateAnswerFormat,
  finalizeOutcome,
  roundPercentage,
  optionsToArray,
  type GradableQuestion,
} from "./auto-grade.js";
import { AppError } from "../../shared/utils/AppError.js";

const mcq: GradableQuestion = {
  id: "q-mcq",
  type: "MCQ",
  options: ["١", "٢", "٣", "٤"],
  correctAnswer: "٣",
  points: 2,
  sortOrder: 1,
};
const tf: GradableQuestion = {
  id: "q-tf",
  type: "TRUE_FALSE",
  options: ["صح", "خطأ"],
  correctAnswer: "صح",
  points: 1,
  sortOrder: 2,
};
const essay: GradableQuestion = {
  id: "q-essay",
  type: "ESSAY",
  options: null,
  correctAnswer: null,
  points: 5,
  sortOrder: 3,
};

function answers(map: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(map));
}

describe("gradeAttempt", () => {
  it("awards full points for a correct MCQ", () => {
    const o = gradeAttempt([mcq], answers({ "q-mcq": "٣" }));
    expect(o.results[0]!.result).toBe("correct");
    expect(o.results[0]!.awardedPoints).toBe(2);
    expect(o.score).toBe(2);
    expect(o.totalPoints).toBe(2);
  });

  it("awards zero for an incorrect MCQ", () => {
    const o = gradeAttempt([mcq], answers({ "q-mcq": "٢" }));
    expect(o.results[0]!.result).toBe("incorrect");
    expect(o.results[0]!.awardedPoints).toBe(0);
    expect(o.score).toBe(0);
  });

  it("grades a correct TRUE_FALSE", () => {
    const o = gradeAttempt([tf], answers({ "q-tf": "صح" }));
    expect(o.results[0]!.result).toBe("correct");
    expect(o.score).toBe(1);
  });

  it("grades an incorrect TRUE_FALSE", () => {
    const o = gradeAttempt([tf], answers({ "q-tf": "خطأ" }));
    expect(o.results[0]!.result).toBe("incorrect");
    expect(o.score).toBe(0);
  });

  it("normalizes English true/false to the canonical Arabic answer", () => {
    const o = gradeAttempt([tf], answers({ "q-tf": "true" }));
    expect(o.results[0]!.result).toBe("correct");
  });

  it("marks ESSAY as pending with null awardedPoints", () => {
    const o = gradeAttempt([essay], answers({ "q-essay": "إجابة مقالية" }));
    expect(o.results[0]!.result).toBe("pending");
    expect(o.results[0]!.awardedPoints).toBeNull();
    expect(o.pendingEssayCount).toBe(1);
    expect(o.isFinal).toBe(false);
  });

  it("computes score, totalPoints, and rounded percentage for a mixed quiz", () => {
    // correct MCQ (2) + incorrect TF (0) + pending essay (0 so far); total 8
    const o = gradeAttempt(
      [mcq, tf, essay],
      answers({ "q-mcq": "٣", "q-tf": "خطأ", "q-essay": "نص" }),
    );
    expect(o.totalPoints).toBe(8);
    expect(o.score).toBe(2);
    expect(o.percentage).toBe(25); // 2/8*100
    expect(o.pendingEssayCount).toBe(1);
    expect(o.isFinal).toBe(false);
  });

  it("rounds percentage to two decimals", () => {
    expect(roundPercentage(3, 7)).toBe(42.86);
    expect(roundPercentage(0, 0)).toBe(0);
  });

  it("preserves question order by sortOrder regardless of input order", () => {
    const o = gradeAttempt(
      [essay, mcq, tf],
      answers({ "q-mcq": "٣", "q-tf": "صح", "q-essay": "نص" }),
    );
    expect(o.results.map((r) => r.questionId)).toEqual(["q-mcq", "q-tf", "q-essay"]);
  });

  it("does not mutate the input questions array", () => {
    const input = [essay, mcq, tf];
    const snapshot = input.map((q) => q.id);
    gradeAttempt(input, answers({ "q-mcq": "٣", "q-tf": "صح", "q-essay": "x" }));
    expect(input.map((q) => q.id)).toEqual(snapshot);
  });

  it("is GRADED-eligible (isFinal) when there are no essays", () => {
    const o = gradeAttempt([mcq, tf], answers({ "q-mcq": "٣", "q-tf": "صح" }));
    expect(o.pendingEssayCount).toBe(0);
    expect(o.isFinal).toBe(true);
  });
});

describe("validateAnswerFormat", () => {
  it("accepts an MCQ answer that is one of the options", () => {
    expect(() => validateAnswerFormat(mcq, "٣")).not.toThrow();
  });

  it("rejects an MCQ answer that is not an option", () => {
    expect(() => validateAnswerFormat(mcq, "٩")).toThrow(AppError);
  });

  it("rejects an unsupported TRUE_FALSE value", () => {
    expect(() => validateAnswerFormat(tf, "ربما")).toThrow(AppError);
  });

  it("accepts Arabic and English TF tokens", () => {
    expect(() => validateAnswerFormat(tf, "صح")).not.toThrow();
    expect(() => validateAnswerFormat(tf, "false")).not.toThrow();
  });

  it("rejects a blank essay", () => {
    expect(() => validateAnswerFormat(essay, "   ")).toThrow(AppError);
  });
});

describe("finalizeOutcome", () => {
  it("recomputes totals after essay grading", () => {
    const o = finalizeOutcome([
      { questionId: "a", type: "MCQ", answer: "x", result: "correct", awardedPoints: 2, maxPoints: 2, feedback: null },
      { questionId: "b", type: "ESSAY", answer: "y", result: "graded", awardedPoints: 4, maxPoints: 5, feedback: "جيد" },
    ]);
    expect(o.score).toBe(6);
    expect(o.totalPoints).toBe(7);
    expect(o.percentage).toBe(85.71);
    expect(o.pendingEssayCount).toBe(0);
    expect(o.isFinal).toBe(true);
  });
});

describe("optionsToArray", () => {
  it("handles array options", () => {
    expect(optionsToArray(["a", "b"])).toEqual(["a", "b"]);
  });
  it("handles object options", () => {
    expect(optionsToArray({ a: "x", b: "y" })).toEqual(["x", "y"]);
  });
  it("handles null/invalid options", () => {
    expect(optionsToArray(null)).toEqual([]);
  });
});
