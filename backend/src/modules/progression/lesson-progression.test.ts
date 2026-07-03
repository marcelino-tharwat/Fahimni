import { describe, it, expect } from "vitest";
import {
  evaluateChapterLessons,
  evaluateLessonAccess,
  evaluateQuizRequirement,
  pickProgressionAttempt,
  scorePercentage,
  type ChapterProgressionContext,
} from "./lesson-progression.js";

function ctx(
  overrides: Partial<ChapterProgressionContext> & {
    lessons: ChapterProgressionContext["lessons"];
  },
): ChapterProgressionContext {
  return {
    chapterId: "ch-1",
    enrolled: true,
    completedLessonIds: new Set(),
    quizzesById: new Map(),
    attemptsByQuizId: new Map(),
    ...overrides,
  };
}

describe("evaluateLessonAccess", () => {
  it("unlocks the first lesson by default", () => {
    const evaluation = evaluateLessonAccess(
      0,
      ctx({
        lessons: [
          { id: "l1", sortOrder: 1, requiredQuizId: null },
          { id: "l2", sortOrder: 2, requiredQuizId: null },
        ],
      }),
    );
    expect(evaluation.isUnlocked).toBe(true);
    expect(evaluation.lockReason).toBeNull();
  });

  it("locks the second lesson until the first is completed", () => {
    const base = ctx({
      lessons: [
        { id: "l1", sortOrder: 1, requiredQuizId: null },
        { id: "l2", sortOrder: 2, requiredQuizId: null },
      ],
    });
    expect(evaluateLessonAccess(1, base).lockReason).toBe(
      "PREVIOUS_LESSON_NOT_COMPLETED",
    );

    const completed = ctx({
      ...base,
      completedLessonIds: new Set(["l1"]),
    });
    expect(evaluateLessonAccess(1, completed).isUnlocked).toBe(true);
  });

  it("keeps next lesson locked when required quiz is not passed", () => {
    const base = ctx({
      lessons: [
        { id: "l1", sortOrder: 1, requiredQuizId: "q1" },
        { id: "l2", sortOrder: 2, requiredQuizId: null },
      ],
      completedLessonIds: new Set(["l1"]),
      quizzesById: new Map([
        ["q1", { id: "q1", status: "PUBLISHED", passingScore: 50 }],
      ]),
      attemptsByQuizId: new Map([
        [
          "q1",
          { quizId: "q1", status: "GRADED", score: 2, totalPoints: 10 },
        ],
      ]),
    });
    expect(evaluateLessonAccess(1, base).lockReason).toBe(
      "REQUIRED_QUIZ_NOT_PASSED",
    );
  });

  it("unlocks next lesson after required quiz passes", () => {
    const base = ctx({
      lessons: [
        { id: "l1", sortOrder: 1, requiredQuizId: "q1" },
        { id: "l2", sortOrder: 2, requiredQuizId: null },
      ],
      completedLessonIds: new Set(["l1"]),
      quizzesById: new Map([
        ["q1", { id: "q1", status: "PUBLISHED", passingScore: 50 }],
      ]),
      attemptsByQuizId: new Map([
        [
          "q1",
          { quizId: "q1", status: "GRADED", score: 8, totalPoints: 10 },
        ],
      ]),
    });
    const eval2 = evaluateLessonAccess(1, base);
    expect(eval2.isUnlocked).toBe(true);
    expect(evaluateLessonAccess(0, base).nextLessonId).toBe("l2");
  });

  it("treats zero score as a valid failed result", () => {
    const pct = scorePercentage(0, 10);
    expect(pct).toBe(0);
    const evalQuiz = evaluateQuizRequirement(
      "q1",
      {
        quizzesById: new Map([
          ["q1", { id: "q1", status: "PUBLISHED", passingScore: 50 }],
        ]),
        attemptsByQuizId: new Map([
          [
            "q1",
            { quizId: "q1", status: "GRADED", score: 0, totalPoints: 10 },
          ],
        ]),
      },
    );
    expect(evalQuiz.satisfied).toBe(false);
  });

  it("awaits grading for COMPLETED essay attempts", () => {
    const evalQuiz = evaluateQuizRequirement("q1", {
      quizzesById: new Map([
        ["q1", { id: "q1", status: "PUBLISHED", passingScore: 50 }],
      ]),
      attemptsByQuizId: new Map([
        ["q1", { quizId: "q1", status: "COMPLETED", score: 5, totalPoints: 10 }],
      ]),
    });
    expect(evalQuiz.lockReason).toBe("REQUIRED_QUIZ_AWAITING_GRADING");
  });

  it("keeps next lesson locked when required quiz is draft/unpublished", () => {
    const base = ctx({
      lessons: [
        { id: "l1", sortOrder: 1, requiredQuizId: "q1" },
        { id: "l2", sortOrder: 2, requiredQuizId: null },
      ],
      completedLessonIds: new Set(["l1"]),
      quizzesById: new Map([
        ["q1", { id: "q1", status: "DRAFT", passingScore: 50 }],
      ]),
    });
    expect(evaluateLessonAccess(1, base).isUnlocked).toBe(false);
    expect(evaluateLessonAccess(1, base).lockReason).toBe(
      "REQUIRED_QUIZ_NOT_COMPLETED",
    );
    expect(evaluateLessonAccess(0, base).nextLessonId).toBeNull();
  });

  it("returns null nextLessonId when lesson complete but required quiz unsatisfied", () => {
    const base = ctx({
      lessons: [
        { id: "l1", sortOrder: 1, requiredQuizId: "q1" },
        { id: "l2", sortOrder: 2, requiredQuizId: null },
      ],
      completedLessonIds: new Set(["l1"]),
      quizzesById: new Map([
        ["q1", { id: "q1", status: "PUBLISHED", passingScore: 50 }],
      ]),
    });
    expect(evaluateLessonAccess(0, base).nextLessonId).toBeNull();
  });
});

describe("pickProgressionAttempt", () => {
  it("prefers the latest graded attempt over an older pass", () => {
    const picked = pickProgressionAttempt([
      {
        quizId: "q1",
        status: "GRADED",
        score: 8,
        totalPoints: 10,
        completedAt: new Date("2026-01-01"),
      },
      {
        quizId: "q1",
        status: "GRADED",
        score: 2,
        totalPoints: 10,
        completedAt: new Date("2026-01-02"),
      },
    ]);
    expect(picked?.score).toBe(2);
  });
});

describe("evaluateChapterLessons", () => {
  it("evaluates all lessons in order", () => {
    const evaluations = evaluateChapterLessons(
      ctx({
        lessons: [
          { id: "l1", sortOrder: 1, requiredQuizId: null },
          { id: "l2", sortOrder: 2, requiredQuizId: null },
        ],
      }),
    );
    expect(evaluations).toHaveLength(2);
    expect(evaluations[0]?.isUnlocked).toBe(true);
    expect(evaluations[1]?.isUnlocked).toBe(false);
  });
});
