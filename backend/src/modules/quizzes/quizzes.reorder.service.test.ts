import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable Prisma mock (pure unit test; no DB).
const tx = vi.hoisted(() => ({
  question: { update: vi.fn(), findMany: vi.fn() },
}));
const mockPrisma = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn() },
  question: { findMany: vi.fn() },
  $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn() },
}));

import { QuizService } from "./quizzes.service.js";
import { AppError } from "../../shared/utils/AppError.js";

const QUIZ = "quiz-1";
const TEACHER = "teacher-1";

function prime(ids: string[]) {
  mockPrisma.quiz.findFirst.mockResolvedValue({ id: QUIZ, status: "DRAFT", title: "Q" });
  mockPrisma.question.findMany.mockResolvedValue(ids.map((id) => ({ id })));
  tx.question.update.mockResolvedValue({});
  tx.question.findMany.mockResolvedValue(
    ids.map((id, i) => ({ id, quizId: QUIZ, type: "MCQ", text: "t", options: [], correctAnswer: null, sortOrder: i + 1, createdAt: new Date(), updatedAt: new Date() })),
  );
}

describe("QuizService.reorderQuestions — two-phase, constraint-safe", () => {
  const svc = new QuizService();
  beforeEach(() => vi.clearAllMocks());

  it("updates every question twice: unique negatives first, then final 1-based positions", async () => {
    prime(["a", "b", "c"]);
    await svc.reorderQuestions(QUIZ, TEACHER, ["c", "b", "a"]);

    const calls = tx.question.update.mock.calls.map((c) => c[0]);
    // 2 phases x 3 questions
    expect(calls).toHaveLength(6);

    // Phase 1: negative placeholders (no collision with existing positives).
    const phase1 = calls.slice(0, 3);
    expect(phase1.map((c) => c.data.sortOrder)).toEqual([-1, -2, -3]);
    expect(phase1.every((c) => c.data.sortOrder < 0)).toBe(true);

    // Phase 2: final positions in the requested order.
    const phase2 = calls.slice(3);
    expect(phase2.map((c) => ({ id: c.where.id, sortOrder: c.data.sortOrder }))).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "a", sortOrder: 3 },
    ]);

    // All writes happen inside one transaction.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects an incomplete id set (must include all questions) without writing", async () => {
    prime(["a", "b", "c"]);
    await expect(svc.reorderQuestions(QUIZ, TEACHER, ["a", "b"])).rejects.toThrow(AppError);
    expect(tx.question.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    prime(["a", "b", "c"]);
    await expect(svc.reorderQuestions(QUIZ, TEACHER, ["a", "b", "zzz"])).rejects.toThrow(AppError);
  });
});
