import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  quiz: { findUnique: vi.fn() },
  question: { findMany: vi.fn() },
  quizAttempt: { findMany: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { AttemptsService } from "./attempts.service.js";
import { AppError } from "../../shared/utils/AppError.js";

const TEACHER = "teacher-1";
const QUIZ = "quiz-1";
const Q_MCQ = "11111111-1111-4111-8111-111111111111";
const Q_ESSAY = "22222222-2222-4222-8222-222222222222";

const service = new AttemptsService();

function questions() {
  return [
    { id: Q_MCQ, text: "ما العاصمة؟", type: "MCQ", points: 2, sortOrder: 1 },
    { id: Q_ESSAY, text: "اشرح", type: "ESSAY", points: 3, sortOrder: 2 },
  ];
}

/** One stored attempt with given score/name/status and per-question results. */
function attempt(opts: {
  id: string;
  name: string;
  score: number | null;
  status: "COMPLETED" | "GRADED";
  essay: "pending" | "graded";
}) {
  return {
    id: opts.id,
    studentId: `s-${opts.id}`,
    status: opts.status,
    score: opts.score,
    totalPoints: 5,
    completedAt: new Date("2026-06-28T10:00:00.000Z"),
    student: { fullName: opts.name },
    answers: [
      { questionId: Q_MCQ, type: "MCQ", answer: "القاهرة", result: "correct", awardedPoints: 2, maxPoints: 2, feedback: null },
      {
        questionId: Q_ESSAY,
        type: "ESSAY",
        answer: "...",
        result: opts.essay,
        awardedPoints: opts.essay === "graded" ? 3 : null,
        maxPoints: 3,
        feedback: opts.essay === "graded" ? "جيد" : null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.quiz.findUnique.mockResolvedValue({ id: QUIZ, createdBy: TEACHER });
  mockPrisma.question.findMany.mockResolvedValue(questions());
});

describe("AttemptsService results (STORY-68)", () => {
  it("rejects a missing quiz (404) and a non-owner teacher (403)", async () => {
    mockPrisma.quiz.findUnique.mockResolvedValueOnce(null);
    await expect(service.getQuizResults(QUIZ, TEACHER, {})).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.quiz.findUnique.mockResolvedValueOnce({ id: QUIZ, createdBy: "other" });
    await expect(service.getQuizResults(QUIZ, TEACHER, {})).rejects.toBeInstanceOf(AppError);
    await expect(service.getQuizResults(QUIZ, "other-teacher", {})).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns per-question breakdown for each attempt", async () => {
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      attempt({ id: "a1", name: "أحمد", score: 5, status: "GRADED", essay: "graded" }),
    ]);
    const out = await service.getQuizResults(QUIZ, TEACHER, {});
    expect(out.count).toBe(1);
    const row = out.results[0]!;
    expect(row.studentName).toBe("أحمد");
    expect(row.score).toBe(5);
    expect(row.percentage).toBe(100);
    expect(row.questions).toHaveLength(2);
    expect(row.questions[0]).toMatchObject({ questionId: Q_MCQ, questionText: "ما العاصمة؟", result: "correct", awardedPoints: 2, maxPoints: 2 });
    expect(row.questions[1]).toMatchObject({ questionId: Q_ESSAY, result: "graded", awardedPoints: 3, feedback: "جيد" });
  });

  it("sorts by score descending by default with deterministic name tie-break", async () => {
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      attempt({ id: "a-low", name: "خالد", score: 5, status: "GRADED", essay: "graded" }),
      attempt({ id: "a-zee", name: "زياد", score: 9, status: "GRADED", essay: "graded" }),
      attempt({ id: "a-ahm", name: "أحمد", score: 9, status: "GRADED", essay: "graded" }),
    ]);
    const out = await service.getQuizResults(QUIZ, TEACHER, {});
    // 9s first; tie broken by name asc (أحمد before زياد); then 5.
    expect(out.results.map((r) => r.studentName)).toEqual(["أحمد", "زياد", "خالد"]);
  });

  it("sorts by student name when requested", async () => {
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      attempt({ id: "a1", name: "زياد", score: 9, status: "GRADED", essay: "graded" }),
      attempt({ id: "a2", name: "أحمد", score: 1, status: "GRADED", essay: "graded" }),
    ]);
    const asc = await service.getQuizResults(QUIZ, TEACHER, { sortBy: "studentName", sortOrder: "asc" });
    expect(asc.results.map((r) => r.studentName)).toEqual(["أحمد", "زياد"]);
    const desc = await service.getQuizResults(QUIZ, TEACHER, { sortBy: "studentName", sortOrder: "desc" });
    expect(desc.results.map((r) => r.studentName)).toEqual(["زياد", "أحمد"]);
  });

  it("ungraded returns only COMPLETED (pending-essay) attempts", async () => {
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      attempt({ id: "a1", name: "أحمد", score: null, status: "COMPLETED", essay: "pending" }),
      attempt({ id: "a2", name: "زياد", score: 5, status: "GRADED", essay: "graded" }),
    ]);
    const out = await service.getUngradedResults(QUIZ, TEACHER);
    expect(out.count).toBe(1);
    expect(out.results[0]!.studentName).toBe("أحمد");
    expect(out.results[0]!.pendingEssayCount).toBe(1);
  });

  it("builds a valid CSV with BOM, header, and injection/quote escaping", async () => {
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      attempt({ id: "a1", name: "Ali, Hassan", score: 5, status: "GRADED", essay: "graded" }),
      attempt({ id: "a2", name: "=cmd()", score: 2, status: "GRADED", essay: "graded" }),
    ]);
    const csv = await service.buildResultsCsv(QUIZ, TEACHER);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Student Name,Status,Score,Total Points,Percentage,Pending Essays,Submitted At");
    // Comma-containing name is quoted.
    expect(lines.some((l) => l.includes('"Ali, Hassan"'))).toBe(true);
    // Formula-injection name is neutralized with a leading apostrophe.
    expect(lines.some((l) => l.startsWith("'=cmd()"))).toBe(true);
  });
});
