import { describe, it, expect } from "vitest";
import { gradeAttempt, type GradableQuestion } from "./auto-grade.js";
import { clampScore, parseEssaySuggestion } from "./essay-ai-grading.js";
import { studentQuestionPublicFields } from "./quizzes.types.js";

const questions: GradableQuestion[] = [
  { id: "m", type: "MCQ", options: ["أ", "ب"], correctAnswer: "أ", points: 1, sortOrder: 1 },
  { id: "t", type: "TRUE_FALSE", options: ["صح", "خطأ"], correctAnswer: "صح", points: 2, sortOrder: 2 },
  { id: "e", type: "ESSAY", options: null, correctAnswer: null, points: 10, sortOrder: 3 },
];

describe("scoring uses per-question points (not question count)", () => {
  it("total quiz score = sum of question points", () => {
    const outcome = gradeAttempt(questions, new Map());
    expect(outcome.totalPoints).toBe(13); // 1 + 2 + 10, not 3
  });

  it("objective earned score = question.points when correct, 0 otherwise", () => {
    const answers = new Map([
      ["m", "أ"], // correct → 1
      ["t", "خطأ"], // wrong → 0
    ]);
    const outcome = gradeAttempt(questions, answers);
    const mcq = outcome.results.find((r) => r.questionId === "m")!;
    const tf = outcome.results.find((r) => r.questionId === "t")!;
    expect(mcq.awardedPoints).toBe(1);
    expect(tf.awardedPoints).toBe(0);
    expect(tf.maxPoints).toBe(2);
  });

  it("essay max score = question.points and stays pending until graded", () => {
    const outcome = gradeAttempt(questions, new Map([["e", "إجابة مقالية"]]));
    const essay = outcome.results.find((r) => r.questionId === "e")!;
    expect(essay.maxPoints).toBe(10);
    expect(essay.awardedPoints).toBeNull();
    expect(essay.result).toBe("pending");
  });

  it("percentage is computed from earned/total points, not question count", () => {
    // All objective correct (1 + 2 = 3 of 13) → 23.08%, not 66% (2 of 3 questions).
    const answers = new Map([
      ["m", "أ"],
      ["t", "صح"],
    ]);
    const objectiveOnly = gradeAttempt(
      questions.filter((q) => q.type !== "ESSAY"),
      answers,
    );
    expect(objectiveOnly.totalPoints).toBe(3);
    expect(objectiveOnly.percentage).toBe(100);

    const full = gradeAttempt(questions, answers);
    // earned 3 of 13 max
    expect(full.score).toBe(3);
    expect(full.percentage).toBe(23.08);
  });
});

describe("essay AI-suggested score respects question points as max", () => {
  it("clamps a suggestion to [0, question.points]", () => {
    expect(clampScore(999, 10)).toBe(10);
    expect(clampScore(-5, 10)).toBe(0);
  });

  it("parseEssaySuggestion never exceeds the provided max points", () => {
    const raw = JSON.stringify({ suggestedScore: 50, feedback: "جيد" });
    const suggestion = parseEssaySuggestion(raw, 10);
    expect(suggestion.suggestedScore).toBeLessThanOrEqual(10);
  });
});

describe("student visibility — question payload never leaks teacher metadata", () => {
  it("student question fields expose no source/difficulty/correctAnswer", () => {
    const keys = Object.keys(studentQuestionPublicFields);
    expect(keys).not.toContain("correctAnswer");
    expect(keys).not.toContain("sourceLessonId");
    expect(keys).not.toContain("sourceLessonTitle");
    expect(keys).not.toContain("sourceChapterTitle");
    expect(keys).not.toContain("difficulty");
    expect(keys).not.toContain("explanation");
  });
});
