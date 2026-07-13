import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for a bug found while auditing the /student/quizzes badges:
// the list used to hand back a hardcoded `difficulty: "medium"` for every
// quiz regardless of the real, teacher-chosen, persisted value. This proves
// the real `Quiz.difficulty` column now flows through unchanged (lowercased
// to match the existing student-facing contract), and that pass/fail still
// reflects the real score vs. the real `passingScore` end-to-end through the
// service (not just at the `deriveQuizDisplayStatus` unit level).

const mockPrisma = vi.hoisted(() => ({
  quiz: { findMany: vi.fn() },
  quizAttempt: { findMany: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

const mockListStudentAccessibleChapters = vi.hoisted(() => vi.fn());
vi.mock("../progression/student-chapter-access.js", () => ({
  listStudentAccessibleChapters: mockListStudentAccessibleChapters,
  assertStudentChapterAccess: vi.fn(),
}));

const mockComputeChapterQuizEligibility = vi.hoisted(() => vi.fn());
vi.mock("./student-quiz-eligibility.service.js", () => ({
  computeChapterQuizEligibility: mockComputeChapterQuizEligibility,
}));

const mockResolveStudentQuizSourceScopes = vi.hoisted(() => vi.fn());
vi.mock("./quiz-scope.js", () => ({
  resolveStudentQuizSourceScopes: mockResolveStudentQuizSourceScopes,
}));

import { AttemptsService } from "./attempts.service.js";

const STUDENT = "student-1";
const CHAPTER = "chapter-1";
const QUIZ_EASY = "quiz-easy";
const QUIZ_HARD_FAILED = "quiz-hard-failed";
const QUIZ_HARD_NO_ATTEMPT = "quiz-hard-no-attempt";
const QUIZ_IN_PROGRESS = "quiz-in-progress";

const service = new AttemptsService();

beforeEach(() => {
  vi.clearAllMocks();
  mockListStudentAccessibleChapters.mockResolvedValue([
    { id: CHAPTER, name: "Chapter One", price: 0, stage: { name: "Stage One" } },
  ]);
  mockComputeChapterQuizEligibility.mockResolvedValue(new Map());
  mockResolveStudentQuizSourceScopes.mockResolvedValue(new Map());
  mockPrisma.quiz.findMany.mockResolvedValue([
    {
      id: QUIZ_EASY,
      title: "Easy quiz",
      questionCount: 2,
      totalPoints: 10,
      durationMinutes: 15,
      chapterId: CHAPTER,
      passingScore: 50,
      difficulty: "EASY",
      sourceScope: "SINGLE_CHAPTER",
      sourceChapterIds: [],
      sourceStageId: null,
    },
    {
      id: QUIZ_HARD_FAILED,
      title: "Hard quiz (failed)",
      questionCount: 2,
      totalPoints: 10,
      durationMinutes: 15,
      chapterId: CHAPTER,
      passingScore: 50,
      difficulty: "HARD",
      sourceScope: "SINGLE_CHAPTER",
      sourceChapterIds: [],
      sourceStageId: null,
    },
    {
      id: QUIZ_HARD_NO_ATTEMPT,
      title: "Hard quiz (unattempted)",
      questionCount: 2,
      totalPoints: 10,
      durationMinutes: 15,
      chapterId: CHAPTER,
      passingScore: 50,
      difficulty: "HARD",
      sourceScope: "SINGLE_CHAPTER",
      sourceChapterIds: [],
      sourceStageId: null,
    },
    {
      id: QUIZ_IN_PROGRESS,
      title: "In-progress quiz",
      questionCount: 2,
      totalPoints: 10,
      durationMinutes: 15,
      chapterId: CHAPTER,
      passingScore: 50,
      difficulty: "MEDIUM",
      sourceScope: "SINGLE_CHAPTER",
      sourceChapterIds: [],
      sourceStageId: null,
    },
  ]);
  mockPrisma.quizAttempt.findMany.mockResolvedValue([
    { id: "attempt-1", quizId: QUIZ_EASY, status: "GRADED", score: 8, totalPoints: 10 },
    { id: "attempt-2", quizId: QUIZ_HARD_FAILED, status: "GRADED", score: 3, totalPoints: 10 },
    { id: "attempt-3", quizId: QUIZ_IN_PROGRESS, status: "IN_PROGRESS", score: null, totalPoints: 10 },
  ]);
});

describe("AttemptsService.getStudentQuizList — real difficulty + real pass/fail", () => {
  it("1. returns the real persisted difficulty per quiz, lowercased (never the old hardcoded 'medium')", async () => {
    const result = await service.getStudentQuizList(STUDENT);
    const quizzes = result.chapters[0]!.quizzes;
    expect(quizzes.find((q) => q.id === QUIZ_EASY)!.difficulty).toBe("easy");
    expect(quizzes.find((q) => q.id === QUIZ_HARD_FAILED)!.difficulty).toBe("hard");
    expect(quizzes.find((q) => q.id === QUIZ_IN_PROGRESS)!.difficulty).toBe("medium");
  });

  it("2 & 3. passed is true (green) when scorePercent >= passingScore, with the real percent", async () => {
    const result = await service.getStudentQuizList(STUDENT);
    const easy = result.chapters[0]!.quizzes.find((q) => q.id === QUIZ_EASY)!;
    expect(easy.status).toBe("passed");
    expect(easy.score).toBe(80);
  });

  it("4. passed is false (failed/red) when scorePercent < passingScore, with the real percent", async () => {
    const result = await service.getStudentQuizList(STUDENT);
    const hard = result.chapters[0]!.quizzes.find((q) => q.id === QUIZ_HARD_FAILED)!;
    expect(hard.status).toBe("failed");
    expect(hard.score).toBe(30);
  });

  it("5. no completed attempt → status 'new' (frontend renders no pass/fail badge)", async () => {
    const result = await service.getStudentQuizList(STUDENT);
    const unattempted = result.chapters[0]!.quizzes.find((q) => q.id === QUIZ_HARD_NO_ATTEMPT)!;
    expect(unattempted.status).toBe("new");
    expect(unattempted.score).toBeUndefined();
  });

  it("6. an in-progress (draft) attempt is never surfaced as passed/failed", async () => {
    const result = await service.getStudentQuizList(STUDENT);
    const inProgress = result.chapters[0]!.quizzes.find((q) => q.id === QUIZ_IN_PROGRESS)!;
    expect(inProgress.status).toBe("pending");
    expect(inProgress.score).toBeUndefined();
  });
});
