import { describe, it, expect } from "vitest";
import {
  classifyAndOrderQuizzes,
  QUIZ_LOCK_MESSAGES,
  type EligibilityLessonRow,
  type EligibilityQuizRow,
} from "./student-quiz-eligibility.service.js";

const D = (n: number) => new Date(2026, 0, 1, 0, 0, n);

function lesson(
  id: string,
  sortOrder: number,
  requiredQuizId: string | null = null,
): EligibilityLessonRow {
  return { id, sortOrder, requiredQuizId };
}

function quiz(
  id: string,
  contentScope: "CHAPTER" | "SELECTED_LESSONS",
  linkedLessonIds: string[],
  createdAtSec: number,
): EligibilityQuizRow {
  return {
    id,
    contentScope,
    status: "PUBLISHED",
    passingScore: 50,
    createdAt: D(createdAtSec),
    linkedLessonIds,
  };
}

describe("classifyAndOrderQuizzes", () => {
  it("orders lesson quizzes by lesson sortOrder then the chapter quiz last", () => {
    const lessons = [lesson("l1", 1), lesson("l2", 2), lesson("l3", 3)];
    const quizzes = [
      quiz("chapterQ", "CHAPTER", [], 10),
      quiz("l2Q", "SELECTED_LESSONS", ["l2"], 20),
      quiz("l1Q", "SELECTED_LESSONS", ["l1"], 30),
    ];

    const placements = classifyAndOrderQuizzes(quizzes, lessons);

    expect(placements.get("l1Q")!.order).toBe(1);
    expect(placements.get("l2Q")!.order).toBe(2);
    expect(placements.get("chapterQ")!.order).toBe(3);
    expect(placements.get("chapterQ")!.quizScope).toBe("CHAPTER");
    expect(placements.get("l1Q")!.quizScope).toBe("LESSON");
  });

  it("chains lesson quizzes and points the chapter quiz at the last lesson quiz", () => {
    const lessons = [lesson("l1", 1), lesson("l2", 2)];
    const quizzes = [
      quiz("l1Q", "SELECTED_LESSONS", ["l1"], 10),
      quiz("l2Q", "SELECTED_LESSONS", ["l2"], 20),
      quiz("chapterQ", "CHAPTER", [], 30),
    ];

    const p = classifyAndOrderQuizzes(quizzes, lessons);
    expect(p.get("l1Q")!.previousQuizId).toBeNull();
    expect(p.get("l2Q")!.previousQuizId).toBe("l1Q");
    expect(p.get("chapterQ")!.previousQuizId).toBe("l2Q");
  });

  it("chapter quizzes are peers (do NOT chain to each other)", () => {
    const lessons = [lesson("l1", 1)];
    const quizzes = [
      quiz("l1Q", "SELECTED_LESSONS", ["l1"], 10),
      quiz("cA", "CHAPTER", [], 20),
      quiz("cB", "CHAPTER", [], 30),
    ];
    const p = classifyAndOrderQuizzes(quizzes, lessons);
    expect(p.get("cA")!.previousQuizId).toBe("l1Q");
    expect(p.get("cB")!.previousQuizId).toBe("l1Q");
  });

  it("treats a requiredQuizId gate quiz as a LESSON quiz with no new previous dep", () => {
    const lessons = [lesson("l1", 1, "gateQ")];
    const quizzes = [
      quiz("gateQ", "CHAPTER", [], 10), // CHAPTER-scope but gates lesson l1
      quiz("chapterQ", "CHAPTER", [], 20),
    ];
    const p = classifyAndOrderQuizzes(quizzes, lessons);
    expect(p.get("gateQ")!.quizScope).toBe("LESSON");
    expect(p.get("gateQ")!.requiredLessonIds).toEqual(["l1"]);
    expect(p.get("gateQ")!.previousQuizId).toBeNull();
    // Chapter quiz has no non-gate lesson quiz to depend on.
    expect(p.get("chapterQ")!.previousQuizId).toBeNull();
    expect(p.get("chapterQ")!.requiredLessonIds).toEqual(["l1"]);
  });

  it("chapter quiz in a lesson-less chapter requires no lessons", () => {
    const p = classifyAndOrderQuizzes([quiz("c", "CHAPTER", [], 1)], []);
    expect(p.get("c")!.requiredLessonIds).toEqual([]);
    expect(p.get("c")!.previousQuizId).toBeNull();
  });

  it("exposes Arabic lock messages for every reason code", () => {
    expect(QUIZ_LOCK_MESSAGES.LESSON_NOT_COMPLETED).toContain("الدرس");
    expect(QUIZ_LOCK_MESSAGES.CHAPTER_LESSONS_NOT_COMPLETED).toContain("الفصل");
    expect(QUIZ_LOCK_MESSAGES.PREVIOUS_QUIZ_NOT_COMPLETED).toContain("السابق");
  });
});
