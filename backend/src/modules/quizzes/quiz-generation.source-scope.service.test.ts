import { describe, it, expect, vi, beforeEach } from "vitest";

// Same isolation as quiz-generation.service.test.ts: no real DB/env; deps injected.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key";
});
vi.mock("../../config/database.js", () => ({ prisma: {} }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { QuizGenerationService } from "./quiz-generation.service.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";

const TEACHER = "teacher-1";
const CH1 = "11111111-1111-4111-8111-111111111111";
const CH2 = "22222222-2222-4222-8222-222222222222";
const L1 = "aaaaaaaa-1111-4111-8111-111111111111";
const L2 = "bbbbbbbb-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";

function validGeminiOutput(): string {
  return JSON.stringify({
    title: "اختبار",
    description: "وصف",
    questions: [
      { type: "MCQ", content: "س١", options: ["أ", "ب"], correctAnswer: "أ", points: 1 },
      { type: "TF", content: "س٢", options: ["صح", "خطأ"], correctAnswer: "صح", points: 1 },
      { type: "ESSAY", content: "س٣", options: null, correctAnswer: null, points: 1 },
    ],
  });
}

function persistedQuestions() {
  return [
    { id: "q-1", quizId: "quiz-1", type: "MCQ", text: "س١", options: ["أ", "ب"], correctAnswer: "أ", sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: "q-2", quizId: "quiz-1", type: "TRUE_FALSE", text: "س٢", options: ["صح", "خطأ"], correctAnswer: "صح", sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
    { id: "q-3", quizId: "quiz-1", type: "ESSAY", text: "س٣", options: [], correctAnswer: null, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
  ];
}

function makeMocks() {
  const tx = {
    quiz: { create: vi.fn() },
    question: { createMany: vi.fn(), findMany: vi.fn() },
    quizLesson: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const prisma = {
    chapter: { findFirst: vi.fn(), findMany: vi.fn() },
    lesson: { findMany: vi.fn(), findFirst: vi.fn() },
    stage: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const rag = {
    countChunksInLessons: vi.fn().mockResolvedValue(5),
    similaritySearchInLessons: vi.fn().mockResolvedValue([{ content: "نص مفهرس" }]),
  };
  const gemini = { generateContent: vi.fn().mockResolvedValue(validGeminiOutput()) };
  // Persistence returns a fixed draft; the create() input is what we assert on.
  tx.quiz.create.mockResolvedValue({
    id: "quiz-1",
    title: "اختبار",
    description: "وصف",
    chapterId: CH1,
    contentScope: "CHAPTER",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
  });
  tx.quizLesson.deleteMany.mockResolvedValue({ count: 0 });
  tx.quizLesson.createMany.mockResolvedValue({ count: 0 });
  tx.question.createMany.mockResolvedValue({ count: 3 });
  tx.question.findMany.mockResolvedValue(persistedQuestions());
  return { prisma, rag, gemini, tx };
}

function createData(m: ReturnType<typeof makeMocks>) {
  return (m.tx.quiz.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}

describe("QuizGenerationService — source scope persistence", () => {
  let m: ReturnType<typeof makeMocks>;
  beforeEach(() => {
    vi.clearAllMocks();
    m = makeMocks();
  });

  function service() {
    return new QuizGenerationService({
      prisma: m.prisma as never,
      rag: m.rag as never,
      gemini: m.gemini as never,
    });
  }

  it("SINGLE_CHAPTER (whole chapter) → SINGLE_CHAPTER, CHAPTER, empty chapters, null stage", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({ id: CH1, name: "الفصل" });
    m.prisma.lesson.findMany.mockResolvedValue([{ id: L1, title: "درس" }]);

    const input: GenerateQuizInput = {
      chapterId: CH1,
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 3,
      types: ["MCQ", "TF", "ESSAY"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };
    const result = await service().generate(input, TEACHER);

    const data = createData(m);
    expect(data.sourceScope).toBe("SINGLE_CHAPTER");
    expect(data.contentScope).toBe("CHAPTER");
    expect(data.sourceChapterIds).toEqual([]);
    expect(data.sourceStageId).toBeNull();
    expect(result.sourceScope).toBe("SINGLE_CHAPTER");
    // Whole-chapter scope must not write QuizLesson rows.
    expect(m.tx.quizLesson.createMany).not.toHaveBeenCalled();
  });

  it("SINGLE_CHAPTER (selected lessons) → SINGLE_CHAPTER, SELECTED_LESSONS, QuizLesson populated", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({ id: CH1, name: "الفصل" });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: L1, title: "د١" },
      { id: L2, title: "د٢" },
    ]);
    m.tx.quiz.create.mockResolvedValue({
      id: "quiz-1", title: "اختبار", description: null, chapterId: CH1,
      contentScope: "SELECTED_LESSONS", status: "DRAFT",
      createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
    });

    const input: GenerateQuizInput = {
      chapterId: CH1,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [L1, L2],
      questionCount: 3,
      types: ["MCQ", "TF", "ESSAY"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    };
    await service().generate(input, TEACHER);

    const data = createData(m);
    expect(data.sourceScope).toBe("SINGLE_CHAPTER");
    expect(data.contentScope).toBe("SELECTED_LESSONS");
    expect(data.sourceChapterIds).toEqual([]);
    expect(data.sourceStageId).toBeNull();
    expect(m.tx.quizLesson.createMany).toHaveBeenCalledWith({
      data: [
        { quizId: "quiz-1", lessonId: L1 },
        { quizId: "quiz-1", lessonId: L2 },
      ],
      skipDuplicates: true,
    });
  });

  it("MULTI_CHAPTER → MULTI_CHAPTER with all selected chapters, null stage", async () => {
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ف١" },
      { id: CH2, name: "ف٢" },
    ]);
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: L1, title: "د١" },
      { id: L2, title: "د٢" },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      chapterIds: [CH1, CH2],
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 3,
      types: ["MCQ", "TF", "ESSAY"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };
    const result = await service().generate(input, TEACHER);

    const data = createData(m);
    expect(data.sourceScope).toBe("MULTI_CHAPTER");
    expect(data.contentScope).toBe("CHAPTER");
    expect(data.sourceChapterIds).toEqual([CH1, CH2]);
    expect(data.sourceStageId).toBeNull();
    expect(result.sourceChapterIds).toEqual([CH1, CH2]);
    // chapterId placement keeps the existing "first chapter" behavior.
    expect(data.chapterId).toBe(CH1);
  });

  it("FULL_CURRICULUM → FULL_CURRICULUM with stage set, empty chapter list", async () => {
    m.prisma.stage.findFirst.mockResolvedValue({ id: STAGE, name: "الصف" });
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ف١" },
      { id: CH2, name: "ف٢" },
    ]);
    m.prisma.lesson.findMany.mockResolvedValue([{ id: L1, title: "د١" }]);

    const input: GenerateQuizInput = {
      sourceScope: "FULL_CURRICULUM",
      stageId: STAGE,
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 3,
      types: ["MCQ", "TF", "ESSAY"],
      difficultyMode: "SINGLE",
      difficulty: "hard",
    };
    const result = await service().generate(input, TEACHER);

    const data = createData(m);
    expect(data.sourceScope).toBe("FULL_CURRICULUM");
    expect(data.contentScope).toBe("CHAPTER");
    expect(data.sourceStageId).toBe(STAGE);
    expect(data.sourceChapterIds).toEqual([]);
    expect(result.sourceStageId).toBe(STAGE);
    // chapterId placement = first chapter of the stage.
    expect(data.chapterId).toBe(CH1);
  });

  it("derives sourceChapterIds from the resolved (owned, ordered) chapters, not the raw client order", async () => {
    // Client sends CH2 before CH1; the DB resolver returns them sortOrder-ordered.
    // Persisted provenance must reflect the server-resolved order — proving the
    // value is server-derived, not copied verbatim from the client body.
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ف١" },
      { id: CH2, name: "ف٢" },
    ]);
    m.prisma.lesson.findMany.mockResolvedValue([{ id: L1, title: "د١" }]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      chapterIds: [CH2, CH1],
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 3,
      types: ["MCQ", "TF", "ESSAY"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };
    await service().generate(input, TEACHER);

    expect(createData(m).sourceChapterIds).toEqual([CH1, CH2]);
  });
});
