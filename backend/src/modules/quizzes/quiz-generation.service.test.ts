import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep module import side-effects (Gemini client construction) happy and avoid
// any real DB/env bootstrap. All real dependencies are injected per-test.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key";
});
vi.mock("../../config/database.js", () => ({ prisma: {} }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { QuizGenerationService } from "./quiz-generation.service.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  ContentNotIndexedError,
  GeminiSafetyBlockedError,
  QuizGenerationParseError,
  QuizGenerationTimeoutError,
} from "./quiz-generation.errors.js";
import {
  GeminiContentBlockedError,
  GeminiTimeoutError,
} from "../../shared/errors/geminiErrors.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";

const TEACHER = "teacher-1";
const CHAPTER_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_1 = "22222222-2222-4222-8222-222222222222";
const LESSON_2 = "33333333-3333-4333-8333-333333333333";

function validGeminiOutput(): string {
  return JSON.stringify({
    title: "اختبار الجبر",
    description: "وصف",
    questions: [
      {
        type: "MCQ",
        content: "ما حل س + ٢ = ٥؟",
        options: ["١", "٢", "٣", "٤"],
        correctAnswer: "٣",
        points: 1,
      },
      {
        type: "TF",
        content: "المعادلة الخطية من الدرجة الأولى.",
        options: ["صح", "خطأ"],
        correctAnswer: "صح",
        points: 1,
      },
      {
        type: "ESSAY",
        content: "اشرح الميل.",
        options: null,
        correctAnswer: null,
        points: 1,
      },
    ],
  });
}

function persistedQuestions() {
  return [
    {
      id: "q-1",
      quizId: "quiz-1",
      type: "MCQ",
      text: "ما حل س + ٢ = ٥؟",
      options: ["١", "٢", "٣", "٤"],
      correctAnswer: "٣",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "q-2",
      quizId: "quiz-1",
      type: "TRUE_FALSE",
      text: "المعادلة الخطية من الدرجة الأولى.",
      options: ["صح", "خطأ"],
      correctAnswer: "صح",
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "q-3",
      quizId: "quiz-1",
      type: "ESSAY",
      text: "اشرح الميل.",
      options: [],
      correctAnswer: null,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

function makeMocks() {
  const tx = {
    quiz: { create: vi.fn() },
    question: { createMany: vi.fn(), findMany: vi.fn() },
    quizLesson: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const prisma = {
    chapter: { findFirst: vi.fn() },
    lesson: { findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const rag = {
    countChunksInLessons: vi.fn(),
    similaritySearchInLessons: vi.fn(),
  };
  const gemini = { generateContent: vi.fn() };
  return { prisma, rag, gemini, tx };
}

/** Wire a full happy path through the supplied mocks (chapter source). */
function primeHappyPath(m: ReturnType<typeof makeMocks>) {
  m.prisma.chapter.findFirst.mockResolvedValue({
    id: CHAPTER_ID,
    name: "الجبر",
  });
  m.prisma.lesson.findMany.mockResolvedValue([
    { id: LESSON_1, title: "الدرس الأول" },
  ]);
  m.rag.countChunksInLessons.mockResolvedValue(5);
  m.rag.similaritySearchInLessons.mockResolvedValue([
    { content: "المعادلة الخطية هي معادلة من الدرجة الأولى." },
  ]);
  m.gemini.generateContent.mockResolvedValue(validGeminiOutput());
  m.tx.quiz.create.mockResolvedValue({
    id: "quiz-1",
    title: "اختبار: اختبار الجبر",
    description: "وصف",
    chapterId: CHAPTER_ID,
    contentScope: "CHAPTER",
    status: "DRAFT",
    createdBy: TEACHER,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
  });
  m.tx.quizLesson.deleteMany.mockResolvedValue({ count: 0 });
  m.tx.quizLesson.createMany.mockResolvedValue({ count: 0 });
  m.tx.question.createMany.mockResolvedValue({ count: 3 });
  m.tx.question.findMany.mockResolvedValue(persistedQuestions());
}

const CHAPTER_INPUT: GenerateQuizInput = {
  chapterId: CHAPTER_ID,
  contentScope: "CHAPTER",
  lessonIds: [],
  questionCount: 3,
  types: ["MCQ", "TF", "ESSAY"],
  difficultyMode: "SINGLE",
  difficulty: "medium",
};

describe("QuizGenerationService.generate", () => {
  let m: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    m = makeMocks();
  });

  function service(overrides = {}) {
    return new QuizGenerationService({
      prisma: m.prisma as never,
      rag: m.rag as never,
      gemini: m.gemini as never,
      ...overrides,
    });
  }

  it("creates a DRAFT quiz with persisted questions on success", async () => {
    primeHappyPath(m);
    const result = await service().generate(CHAPTER_INPUT, TEACHER);

    expect(result.status).toBe("DRAFT");
    expect(result.id).toBe("quiz-1");
    expect(result.questionCount).toBe(3);
    expect(result.totalPoints).toBe(3);
    expect(result.chapterId).toBe(CHAPTER_ID);
    expect(result.questions.map((q) => q.id)).toEqual(["q-1", "q-2", "q-3"]);
    expect(result.questions.map((q) => q.sortOrder)).toEqual([1, 2, 3]);
  });

  it("persists per-question points in the createMany payload", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);

    const payloadArg = m.tx.question.createMany.mock.calls[0]![0] as {
      data: Array<{ points: number; sortOrder: number }>;
    };
    expect(payloadArg.data.every((d) => typeof d.points === "number")).toBe(true);
    expect(payloadArg.data.map((d) => d.points)).toEqual([1, 1, 1]);
  });

  it("attaches teacher-only source metadata + difficulty per question", async () => {
    primeHappyPath(m);
    const result = await service().generate(CHAPTER_INPUT, TEACHER);

    for (const q of result.questions) {
      // Single resolved lesson → attributed as the source lesson.
      expect(q.sourceLessonId).toBe(LESSON_1);
      expect(q.sourceLessonTitle).toBe("الدرس الأول");
      expect(q.sourceChapterTitle).toBe("الجبر");
      // SINGLE(medium) with no model label → deterministic fallback.
      expect(q.difficulty).toBe("MEDIUM");
    }
  });

  it("persists the SINGLE-mode chosen difficulty on the Quiz row itself (Quiz.difficulty)", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);

    const createArg = m.tx.quiz.create.mock.calls[0]![0] as { data: { difficulty: string } };
    expect(createArg.data.difficulty).toBe("MEDIUM");
  });

  it("persists the MIXED-mode plurality difficulty on the Quiz row (no single choice exists)", async () => {
    primeHappyPath(m);
    const mixedInput: GenerateQuizInput = {
      ...CHAPTER_INPUT,
      difficultyMode: "MIXED",
      difficulty: undefined,
      difficultyDistribution: { easy: 10, medium: 20, hard: 70 },
    };
    await service().generate(mixedInput, TEACHER);

    const createArg = m.tx.quiz.create.mock.calls[0]![0] as { data: { difficulty: string } };
    expect(createArg.data.difficulty).toBe("HARD");
  });

  it("nulls the source lesson when more than one lesson fed generation", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER_ID, name: "الجبر" });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: LESSON_1, title: "د١" },
      { id: LESSON_2, title: "د٢" },
    ]);
    m.rag.countChunksInLessons.mockResolvedValue(5);
    m.rag.similaritySearchInLessons.mockResolvedValue([{ content: "نص" }]);
    m.gemini.generateContent.mockResolvedValue(validGeminiOutput());
    m.tx.quiz.create.mockResolvedValue({
      id: "quiz-1",
      title: "t",
      description: null,
      chapterId: CHAPTER_ID,
      contentScope: "SELECTED_LESSONS",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    m.tx.quizLesson.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.quizLesson.createMany.mockResolvedValue({ count: 2 });
    m.tx.question.createMany.mockResolvedValue({ count: 3 });
    m.tx.question.findMany.mockResolvedValue(persistedQuestions());

    const result = await service().generate(
      {
        chapterId: CHAPTER_ID,
        contentScope: "SELECTED_LESSONS",
        lessonIds: [LESSON_1, LESSON_2],
        questionCount: 3,
        types: ["MCQ", "TF", "ESSAY"],
        difficultyMode: "SINGLE",
        difficulty: "easy",
      },
      TEACHER,
    );

    for (const q of result.questions) {
      expect(q.sourceLessonId).toBeNull();
      expect(q.sourceLessonTitle).toBeNull();
      expect(q.sourceChapterTitle).toBe("الجبر");
      expect(q.difficulty).toBe("EASY");
    }
  });

  it("runs RAG → Gemini → persistence in order", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);

    const ragOrder = m.rag.similaritySearchInLessons.mock.invocationCallOrder[0]!;
    const geminiOrder = m.gemini.generateContent.mock.invocationCallOrder[0]!;
    const persistOrder = m.prisma.$transaction.mock.invocationCallOrder[0]!;

    expect(ragOrder).toBeLessThan(geminiOrder);
    expect(geminiOrder).toBeLessThan(persistOrder);
  });

  it("calls Gemini with a 20s timeout configuration", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);

    const call = m.gemini.generateContent.mock.calls[0]!;
    expect(call[2]).toMatchObject({ timeoutMs: 20_000 });
  });

  it("scopes RAG search to the resolved lesson IDs", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);

    expect(m.rag.similaritySearchInLessons).toHaveBeenCalledWith(
      expect.any(String),
      [LESSON_1],
      expect.any(Number),
    );
  });

  it("includes topicFocus in the semantic query when provided", async () => {
    primeHappyPath(m);
    await service().generate(
      { ...CHAPTER_INPUT, topicFocus: "المعادلات الخطية" },
      TEACHER,
    );
    const query = m.rag.similaritySearchInLessons.mock.calls[0]![0] as string;
    expect(query).toContain("المعادلات الخطية");
  });

  it("persists chapterId and contentScope for SELECTED_LESSONS", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({
      id: CHAPTER_ID,
      name: "الجبر",
    });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: LESSON_1, title: "د١" },
      { id: LESSON_2, title: "د٢" },
    ]);
    m.rag.countChunksInLessons.mockResolvedValue(5);
    m.rag.similaritySearchInLessons.mockResolvedValue([{ content: "نص" }]);
    m.gemini.generateContent.mockResolvedValue(validGeminiOutput());
    m.tx.quiz.create.mockResolvedValue({
      id: "quiz-1",
      title: "t",
      description: null,
      chapterId: CHAPTER_ID,
      contentScope: "SELECTED_LESSONS",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    m.tx.quizLesson.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.quizLesson.createMany.mockResolvedValue({ count: 2 });
    m.tx.question.createMany.mockResolvedValue({ count: 3 });
    m.tx.question.findMany.mockResolvedValue(persistedQuestions());

    await service().generate(
      {
        chapterId: CHAPTER_ID,
        contentScope: "SELECTED_LESSONS",
        lessonIds: [LESSON_1, LESSON_2],
        questionCount: 3,
        types: ["MCQ", "TF", "ESSAY"],
        difficultyMode: "SINGLE",
        difficulty: "easy",
      },
      TEACHER,
    );

    const created = m.tx.quiz.create.mock.calls[0]![0] as {
      data: { chapterId: string; contentScope: string };
    };
    expect(created.data.chapterId).toBe(CHAPTER_ID);
    expect(created.data.contentScope).toBe("SELECTED_LESSONS");
    expect(m.tx.quizLesson.createMany).toHaveBeenCalledWith({
      data: [
        { quizId: "quiz-1", lessonId: LESSON_1 },
        { quizId: "quiz-1", lessonId: LESSON_2 },
      ],
      skipDuplicates: true,
    });
  });

  it("rejects lessons from another chapter", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({
      id: CHAPTER_ID,
      name: "الجبر",
    });
    m.prisma.lesson.findMany.mockResolvedValue([{ id: LESSON_1, title: "د١" }]);
    m.prisma.lesson.findFirst.mockResolvedValue({ id: LESSON_2 });

    await expect(
      service().generate(
        {
          chapterId: CHAPTER_ID,
          contentScope: "SELECTED_LESSONS",
          lessonIds: [LESSON_1, LESSON_2],
          questionCount: 3,
          types: ["MCQ", "TF", "ESSAY"],
          difficultyMode: "SINGLE",
          difficulty: "easy",
        },
        TEACHER,
      ),
    ).rejects.toMatchObject({ code: "LESSON_NOT_IN_CHAPTER" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects with 404 when the chapter is not owned/found", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue(null);
    await expect(service().generate(CHAPTER_INPUT, TEACHER)).rejects.toThrow(
      AppError,
    );
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes chapter ownership to the authenticated teacher", async () => {
    primeHappyPath(m);
    await service().generate(CHAPTER_INPUT, TEACHER);
    const where = m.prisma.chapter.findFirst.mock.calls[0]![0] as {
      where: { teacherId: string };
    };
    expect(where.where.teacherId).toBe(TEACHER);
  });

  it("fails the whole request when any lesson is missing/unauthorized", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({
      id: CHAPTER_ID,
      name: "الجبر",
    });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: LESSON_1, title: "د١" },
    ]);
    m.prisma.lesson.findFirst.mockResolvedValue(null);
    await expect(
      service().generate(
        {
          chapterId: CHAPTER_ID,
          contentScope: "SELECTED_LESSONS",
          lessonIds: [LESSON_1, LESSON_2],
          questionCount: 3,
          types: ["MCQ", "TF", "ESSAY"],
          difficultyMode: "SINGLE",
          difficulty: "easy",
        },
        TEACHER,
      ),
    ).rejects.toMatchObject({ code: "LESSON_NOT_FOUND" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 422 (ContentNotIndexed) and does not persist when no chunks exist", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({
      id: CHAPTER_ID,
      name: "الجبر",
    });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: LESSON_1, title: "د١" },
    ]);
    m.rag.countChunksInLessons.mockResolvedValue(0);

    await expect(service().generate(CHAPTER_INPUT, TEACHER)).rejects.toThrow(
      ContentNotIndexedError,
    );
    expect(m.gemini.generateContent).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("maps a Gemini safety block to 422 and does not persist", async () => {
    primeHappyPath(m);
    m.gemini.generateContent.mockRejectedValue(new GeminiContentBlockedError());

    const err = await service()
      .generate(CHAPTER_INPUT, TEACHER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(GeminiSafetyBlockedError);
    expect(err.statusCode).toBe(422);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("maps a Gemini timeout to a 422 timeout error (not 500)", async () => {
    primeHappyPath(m);
    m.gemini.generateContent.mockRejectedValue(
      new GeminiTimeoutError("generateContent"),
    );

    const err = await service()
      .generate(CHAPTER_INPUT, TEACHER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(QuizGenerationTimeoutError);
    expect(err.statusCode).toBe(422);
    expect(err.suggestion).toBeTruthy();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 422 and does not persist when parsing fails", async () => {
    primeHappyPath(m);
    m.gemini.generateContent.mockResolvedValue("this is not json");

    await expect(service().generate(CHAPTER_INPUT, TEACHER)).rejects.toThrow(
      QuizGenerationParseError,
    );
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not expose raw Gemini output in the error details", async () => {
    primeHappyPath(m);
    m.gemini.generateContent.mockResolvedValue("SECRET_RAW_MODEL_TEXT {bad}");

    const err = await service()
      .generate(CHAPTER_INPUT, TEACHER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(QuizGenerationParseError);
    expect(JSON.stringify(err)).not.toContain("SECRET_RAW_MODEL_TEXT");
  });

  it("fails with a 422 timeout when the total deadline elapses", async () => {
    primeHappyPath(m);
    // Gemini never resolves → the total-deadline timer must win.
    m.gemini.generateContent.mockReturnValue(new Promise(() => undefined));

    const err = await service({ totalTimeoutMs: 30 })
      .generate(CHAPTER_INPUT, TEACHER)
      .catch((e) => e);

    expect(err).toBeInstanceOf(QuizGenerationTimeoutError);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not persist when Gemini resolves after the total deadline", async () => {
    primeHappyPath(m);
    m.gemini.generateContent.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(validGeminiOutput()), 120),
        ),
    );

    const err = await service({ totalTimeoutMs: 30 })
      .generate(CHAPTER_INPUT, TEACHER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(QuizGenerationTimeoutError);

    // Let the late Gemini promise settle, then confirm nothing was persisted.
    await new Promise((r) => setTimeout(r, 160));
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rolls back (single transaction) if question creation fails", async () => {
    primeHappyPath(m);
    m.tx.question.createMany.mockRejectedValue(new Error("db boom"));

    await expect(service().generate(CHAPTER_INPUT, TEACHER)).rejects.toThrow();
    // Quiz + questions are created within one $transaction call → atomic.
    expect(m.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
