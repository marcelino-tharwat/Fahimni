import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure unit test — Prisma fully mocked, no DB.
const mockPrisma = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn() },
  question: { aggregate: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn() },
}));

import { QuizService } from "./quizzes.service.js";

const QUIZ = "quiz-1";
const TEACHER = "teacher-1";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    quizId: QUIZ,
    type: "MCQ",
    text: "t",
    options: { "1": "أ", "2": "ب" },
    correctAnswer: "أ",
    explanation: null,
    sortOrder: 1,
    points: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("QuizService — per-question points (CRUD)", () => {
  const svc = new QuizService();
  beforeEach(() => vi.clearAllMocks());

  it("applies the type default (ESSAY=5) when points omitted on create", async () => {
    mockPrisma.quiz.findFirst.mockResolvedValue({ id: QUIZ, status: "DRAFT", title: "Q" });
    mockPrisma.question.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    mockPrisma.question.create.mockResolvedValue(row({ type: "ESSAY", points: 5 }));

    await svc.addQuestion(QUIZ, TEACHER, {
      type: "ESSAY",
      content: "اشرح",
      options: {},
      correctAnswer: null,
    } as never);

    const data = mockPrisma.question.create.mock.calls[0]![0].data;
    expect(data.points).toBe(5);
  });

  it("honors an explicit points value on create", async () => {
    mockPrisma.quiz.findFirst.mockResolvedValue({ id: QUIZ, status: "DRAFT", title: "Q" });
    mockPrisma.question.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    mockPrisma.question.create.mockResolvedValue(row({ points: 7 }));

    await svc.addQuestion(QUIZ, TEACHER, {
      type: "MCQ",
      content: "س",
      options: { "1": "أ", "2": "ب" },
      correctAnswer: "أ",
      points: 7,
    } as never);

    expect(mockPrisma.question.create.mock.calls[0]![0].data.points).toBe(7);
  });

  it("updates only the targeted question's points (no cross-write)", async () => {
    mockPrisma.quiz.findFirst.mockResolvedValue({ id: QUIZ, status: "DRAFT", title: "Q" });
    mockPrisma.question.findFirst.mockResolvedValue(row());
    mockPrisma.question.update.mockResolvedValue(row({ points: 9 }));

    const result = await svc.updateQuestion("q-1", QUIZ, TEACHER, { points: 9 } as never);

    // Exactly one question row is updated, by its own id.
    expect(mockPrisma.question.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.question.update.mock.calls[0]![0].where).toEqual({ id: "q-1" });
    expect(mockPrisma.question.update.mock.calls[0]![0].data.points).toBe(9);
    expect(result.points).toBe(9);
  });
});
