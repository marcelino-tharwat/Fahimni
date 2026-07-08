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
import { ContentNotIndexedError } from "./quiz-generation.errors.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";

const TEACHER = "teacher-1";
const CHAP_A = "11111111-1111-4111-8111-111111111111";
const CHAP_B = "aaaaaaaa-1111-4111-8111-111111111111";
const L_A1 = "22222222-2222-4222-8222-222222222222";
const L_A2 = "33333333-3333-4333-8333-333333333333";
const L_B1 = "44444444-4444-4444-8444-444444444444";
const STAGE = "55555555-5555-4555-8555-555555555555";

/** Build a Gemini output with exactly `n` distinct MCQ questions. */
function geminiOutputWithCount(n: number): string {
  return JSON.stringify({
    title: "اختبار",
    description: "وصف",
    questions: Array.from({ length: n }, (_, i) => ({
      type: "MCQ",
      content: `سؤال رقم ${i + 1} حول المحتوى ${Math.random()}`,
      options: ["أ", "ب", "ج", "د"],
      correctAnswer: "أ",
      points: 1,
      difficulty: "medium",
    })),
  });
}

function makeMocks() {
  let capturedQuestions: Array<Record<string, unknown>> = [];
  const tx = {
    quiz: {
      create: vi.fn().mockResolvedValue({
        id: "quiz-1",
        title: "اختبار",
        description: "وصف",
        chapterId: CHAP_A,
        contentScope: "CHAPTER",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    question: {
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        capturedQuestions = data;
        return { count: data.length };
      }),
      findMany: vi.fn(async () =>
        capturedQuestions.map((d, i) => ({
          id: `q-${i + 1}`,
          quizId: "quiz-1",
          type: d.type,
          text: d.text,
          options: d.options,
          correctAnswer: d.correctAnswer,
          sortOrder: d.sortOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ),
    },
    quizLesson: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    chapter: { findFirst: vi.fn(), findMany: vi.fn() },
    lesson: { findMany: vi.fn(), findFirst: vi.fn() },
    stage: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const rag = {
    countChunksInLessons: vi.fn().mockResolvedValue(5),
    similaritySearchInLessons: vi.fn().mockResolvedValue([{ content: "نص مصدر" }]),
  };
  const gemini = {
    generateContent: vi.fn(async (prompt: string) => {
      const match = prompt.match(/أنشئ بالضبط (\d+) سؤال/);
      const n = match ? Number(match[1]) : 1;
      return geminiOutputWithCount(n);
    }),
  };
  return { prisma, rag, gemini, tx };
}

describe("QuizGenerationService — allocation modes", () => {
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

  it("SINGLE_CHAPTER BY_LESSON: one pass per lesson, counts honored + attributed", async () => {
    m.prisma.chapter.findFirst.mockResolvedValue({ id: CHAP_A, name: "الجبر" });
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: L_A1, title: "الدرس الأول" },
      { id: L_A2, title: "الدرس الثاني" },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [],
      lessonAllocations: [
        { lessonId: L_A1, questionCount: 2 },
        { lessonId: L_A2, questionCount: 3 },
      ],
      questionCount: 5,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };

    const result = await service().generate(input, TEACHER);

    expect(result.questionCount).toBe(5);
    // Two Gemini passes (one per lesson).
    expect(m.gemini.generateContent).toHaveBeenCalledTimes(2);
    const fromA1 = result.questions.filter((q) => q.sourceLessonId === L_A1);
    const fromA2 = result.questions.filter((q) => q.sourceLessonId === L_A2);
    expect(fromA1).toHaveLength(2);
    expect(fromA2).toHaveLength(3);
    expect(fromA1[0]!.sourceLessonTitle).toBe("الدرس الأول");
    // Stable sequential sortOrder across merged buckets.
    expect(result.questions.map((q) => q.sortOrder)).toEqual([1, 2, 3, 4, 5]);
    // SELECTED_LESSONS placement persists quiz↔lesson relations.
    expect(m.tx.quizLesson.createMany).toHaveBeenCalled();
  });

  it("MULTI_CHAPTER BY_CHAPTER: one pass per chapter with per-chapter counts", async () => {
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول", lessons: [{ id: L_A1, title: "د١" }] },
      { id: CHAP_B, name: "الفصل الثاني", lessons: [{ id: L_B1, title: "د٢" }] },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      lessonIds: [],
      chapterAllocations: [
        { chapterId: CHAP_A, questionCount: 4 },
        { chapterId: CHAP_B, questionCount: 2 },
      ],
      questionCount: 6,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    };

    const result = await service().generate(input, TEACHER);

    expect(result.questionCount).toBe(6);
    expect(m.gemini.generateContent).toHaveBeenCalledTimes(2);
    expect(
      result.questions.filter((q) => q.sourceChapterTitle === "الفصل الأول"),
    ).toHaveLength(4);
    expect(
      result.questions.filter((q) => q.sourceChapterTitle === "الفصل الثاني"),
    ).toHaveLength(2);
    // Multi-chapter placement is CHAPTER → no quiz↔lesson rows.
    expect(m.tx.quizLesson.createMany).not.toHaveBeenCalled();
  });

  it("MULTI_CHAPTER BY_LESSON: one pass per lesson across chapters", async () => {
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول", lessons: [{ id: L_A1, title: "د١" }, { id: L_A2, title: "د٢" }] },
      { id: CHAP_B, name: "الفصل الثاني", lessons: [{ id: L_B1, title: "د٣" }] },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      lessonIds: [],
      chapterAllocations: [
        { chapterId: CHAP_A, lessonAllocations: [{ lessonId: L_A1, questionCount: 1 }] },
        { chapterId: CHAP_B, lessonAllocations: [{ lessonId: L_B1, questionCount: 2 }] },
      ],
      questionCount: 3,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "hard",
    };

    const result = await service().generate(input, TEACHER);
    expect(result.questionCount).toBe(3);
    expect(m.gemini.generateContent).toHaveBeenCalledTimes(2);
    expect(result.questions.filter((q) => q.sourceLessonId === L_A1)).toHaveLength(1);
    expect(result.questions.filter((q) => q.sourceLessonId === L_B1)).toHaveLength(2);
  });

  it("FULL_CURRICULUM AUTO: single pass over the whole stage", async () => {
    m.prisma.stage.findFirst.mockResolvedValue({ id: STAGE, name: "الصف" });
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول" },
      { id: CHAP_B, name: "الفصل الثاني" },
    ]);
    m.prisma.lesson.findMany.mockResolvedValue([
      { id: L_A1, title: "د١" },
      { id: L_B1, title: "د٢" },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "FULL_CURRICULUM",
      allocationMode: "AUTO",
      stageId: STAGE,
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 4,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };

    const result = await service().generate(input, TEACHER);
    expect(result.questionCount).toBe(4);
    expect(m.gemini.generateContent).toHaveBeenCalledTimes(1);
  });

  it("FULL_CURRICULUM: clear error when the stage has no chapters", async () => {
    m.prisma.stage.findFirst.mockResolvedValue({ id: STAGE, name: "الصف" });
    m.prisma.chapter.findMany.mockResolvedValue([]);

    const input: GenerateQuizInput = {
      sourceScope: "FULL_CURRICULUM",
      stageId: STAGE,
      contentScope: "CHAPTER",
      lessonIds: [],
      questionCount: 4,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };

    await expect(service().generate(input, TEACHER)).rejects.toThrow(
      ContentNotIndexedError,
    );
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized chapter in BY_CHAPTER (404, no persist)", async () => {
    // Only one of the two requested chapters is owned → not found.
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول", lessons: [{ id: L_A1, title: "د١" }] },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      lessonIds: [],
      chapterAllocations: [
        { chapterId: CHAP_A, questionCount: 2 },
        { chapterId: CHAP_B, questionCount: 2 },
      ],
      questionCount: 4,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    };

    await expect(service().generate(input, TEACHER)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a lesson that does not belong to its chapter in MULTI_CHAPTER BY_LESSON", async () => {
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول", lessons: [{ id: L_A1, title: "د١" }] },
      { id: CHAP_B, name: "الفصل الثاني", lessons: [{ id: L_B1, title: "د٣" }] },
    ]);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      lessonIds: [],
      chapterAllocations: [
        // L_B1 does not belong to CHAP_A.
        { chapterId: CHAP_A, lessonAllocations: [{ lessonId: L_B1, questionCount: 2 }] },
        { chapterId: CHAP_B, lessonAllocations: [{ lessonId: L_B1, questionCount: 1 }] },
      ],
      questionCount: 3,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    };

    await expect(service().generate(input, TEACHER)).rejects.toMatchObject({
      code: "LESSON_NOT_IN_CHAPTER",
    });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not persist when a bucket has no indexed content", async () => {
    m.prisma.chapter.findMany.mockResolvedValue([
      { id: CHAP_A, name: "الفصل الأول", lessons: [{ id: L_A1, title: "د١" }] },
      { id: CHAP_B, name: "الفصل الثاني", lessons: [{ id: L_B1, title: "د٢" }] },
    ]);
    // First bucket has chunks, second has none.
    m.rag.countChunksInLessons
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    const input: GenerateQuizInput = {
      sourceScope: "MULTI_CHAPTER",
      allocationMode: "BY_CHAPTER",
      chapterIds: [CHAP_A, CHAP_B],
      contentScope: "CHAPTER",
      lessonIds: [],
      chapterAllocations: [
        { chapterId: CHAP_A, questionCount: 2 },
        { chapterId: CHAP_B, questionCount: 2 },
      ],
      questionCount: 4,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "easy",
    };

    await expect(service().generate(input, TEACHER)).rejects.toThrow(
      ContentNotIndexedError,
    );
    expect(m.gemini.generateContent).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a plan that fans out into too many buckets", async () => {
    const lessons = Array.from({ length: 13 }, (_, i) => ({
      id: `${(i + 1).toString().padStart(8, "0")}-1111-4111-8111-111111111111`,
      title: `درس ${i + 1}`,
    }));
    m.prisma.chapter.findFirst.mockResolvedValue({ id: CHAP_A, name: "الجبر" });
    m.prisma.lesson.findMany.mockResolvedValue(lessons);

    const input: GenerateQuizInput = {
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      chapterId: CHAP_A,
      contentScope: "SELECTED_LESSONS",
      lessonIds: [],
      lessonAllocations: lessons.map((l) => ({ lessonId: l.id, questionCount: 1 })),
      questionCount: 13,
      types: ["MCQ"],
      difficultyMode: "SINGLE",
      difficulty: "medium",
    };

    await expect(service().generate(input, TEACHER)).rejects.toMatchObject({
      code: "QUIZ_ALLOCATION_TOO_MANY_BUCKETS",
    });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
});
