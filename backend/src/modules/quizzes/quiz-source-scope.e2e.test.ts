/**
 * Source-scope persistence + read-safety E2E (real DB, service level).
 *
 * Verifies that after the source_scope / source_chapter_ids / source_stage_id
 * columns were added, the teacher read path surfaces resolved provenance, the
 * student read path surfaces only the student-safe shape, and the student
 * attempt → submit → result flow still works end-to-end for all three source
 * scopes. Uses the shared quiz-visibility fixture (owned stage/chapter, enrolled
 * free student) and adds one attemptable quiz per scope.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../config/database.js";
import {
  seedQuizVisibilityE2EFixture,
  type QuizVisibilityE2EFixture,
} from "../../test/fixtures/quiz-visibility-e2e.fixture.js";
import { TF_OPTIONS, TF_TRUE } from "./quiz-generation.mapping.js";
import { QuizService } from "./quizzes.service.js";
import { quizVisibilityService } from "./quiz-visibility.service.js";
import { attemptsService } from "./attempts.service.js";

const quizService = new QuizService();

const SS_QUIZ = "e2e-ss-single-quiz";
const MS_QUIZ = "e2e-ss-multi-quiz";
const FS_QUIZ = "e2e-ss-full-quiz";
const SS_Q = "e2e0ss10-0001-4000-8000-000000000001";
const MS_Q = "e2e0ss10-0002-4000-8000-000000000002";
const FS_Q = "e2e0ss10-0003-4000-8000-000000000003";
const BOGUS_CHAPTER = "deadbeef-0000-4000-8000-000000000000";

let fx: QuizVisibilityE2EFixture;

async function makeQuiz(
  id: string,
  questionId: string,
  data: {
    sourceScope: "SINGLE_CHAPTER" | "MULTI_CHAPTER" | "FULL_CURRICULUM";
    sourceChapterIds: string[];
    sourceStageId: string | null;
  },
): Promise<void> {
  await prisma.question.deleteMany({ where: { quizId: id } });
  await prisma.quizAttempt.deleteMany({ where: { quizId: id } });
  await prisma.quiz.deleteMany({ where: { id } });
  await prisma.quiz.create({
    data: {
      id,
      title: `E2E source-scope ${data.sourceScope}`,
      chapterId: fx.chapterAId,
      status: "PUBLISHED",
      contentScope: "CHAPTER",
      sourceScope: data.sourceScope,
      sourceChapterIds: data.sourceChapterIds,
      sourceStageId: data.sourceStageId,
      questionCount: 1,
      totalPoints: 5,
      durationMinutes: 15,
      passingScore: 50,
      createdBy: fx.teacher1Id,
      publishedAt: new Date(),
    },
  });
  await prisma.question.create({
    data: {
      id: questionId,
      quizId: id,
      type: "TRUE_FALSE",
      text: "E2E source-scope question",
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
      points: 5,
      sortOrder: 1,
    },
  });
}

beforeAll(async () => {
  fx = await seedQuizVisibilityE2EFixture();
  await makeQuiz(SS_QUIZ, SS_Q, {
    sourceScope: "SINGLE_CHAPTER",
    sourceChapterIds: [],
    sourceStageId: null,
  });
  await makeQuiz(MS_QUIZ, MS_Q, {
    sourceScope: "MULTI_CHAPTER",
    // One accessible chapter + one bogus id (must be filtered out for students).
    sourceChapterIds: [fx.chapterAId, BOGUS_CHAPTER],
    sourceStageId: null,
  });
  await makeQuiz(FS_QUIZ, FS_Q, {
    sourceScope: "FULL_CURRICULUM",
    sourceChapterIds: [],
    sourceStageId: fx.stageId,
  });
});

afterAll(async () => {
  await prisma.question.deleteMany({ where: { quizId: { in: [SS_QUIZ, MS_QUIZ, FS_QUIZ] } } });
  await prisma.quizAttempt.deleteMany({ where: { quizId: { in: [SS_QUIZ, MS_QUIZ, FS_QUIZ] } } });
  await prisma.quiz.deleteMany({ where: { id: { in: [SS_QUIZ, MS_QUIZ, FS_QUIZ] } } });
});

describe("source scope — teacher read path", () => {
  it("list exposes raw columns + resolved titles for every scope", async () => {
    const quizzes = await quizService.list(fx.teacher1Id);
    const byId = new Map(quizzes.map((q) => [q.id, q]));

    const single = byId.get(SS_QUIZ)!;
    expect(single.sourceScope).toBe("SINGLE_CHAPTER");
    expect(single.sourceChapterIds).toEqual([]);
    expect(single.sourceStageId).toBeNull();
    expect(single.sourceChapters).toEqual([]);
    expect(single.sourceStage).toBeNull();

    const multi = byId.get(MS_QUIZ)!;
    expect(multi.sourceScope).toBe("MULTI_CHAPTER");
    expect(multi.sourceChapterIds).toContain(fx.chapterAId);
    // Teacher owns chapterA (bogus id resolves to nothing → dropped from titles).
    expect(multi.sourceChapters).toEqual([
      { id: fx.chapterAId, title: "E2E QV Chapter A" },
    ]);

    const full = byId.get(FS_QUIZ)!;
    expect(full.sourceScope).toBe("FULL_CURRICULUM");
    expect(full.sourceStageId).toBe(fx.stageId);
    expect(full.sourceStage).toEqual({ id: fx.stageId, title: "E2E QV Stage A" });
  });

  it("getById resolves the source scope for the detail view", async () => {
    const detail = await quizService.getById(MS_QUIZ, fx.teacher1Id);
    expect(detail.sourceScope).toBe("MULTI_CHAPTER");
    expect(detail.sourceChapters).toEqual([
      { id: fx.chapterAId, title: "E2E QV Chapter A" },
    ]);
  });
});

describe("source scope — student read path (safety)", () => {
  it("exposes only student-safe source fields, never the raw id arrays", async () => {
    const list = await quizVisibilityService.listChapterQuizzesForStudent(
      fx.student1Id,
      fx.chapterAId,
    );
    const byId = new Map(list.map((q) => [q.id, q]));

    const single = byId.get(SS_QUIZ)!;
    expect(single.sourceScope).toBe("SINGLE_CHAPTER");
    expect(single).not.toHaveProperty("sourceChapters");
    expect(single).not.toHaveProperty("sourceStage");
    expect(single).not.toHaveProperty("sourceChapterIds");
    expect(single).not.toHaveProperty("sourceStageId");

    const multi = byId.get(MS_QUIZ)!;
    expect(multi.sourceScope).toBe("MULTI_CHAPTER");
    // Bogus, inaccessible chapter filtered out; accessible one resolved.
    expect(multi.sourceChapters).toEqual([
      { id: fx.chapterAId, title: "E2E QV Chapter A" },
    ]);
    expect(multi).not.toHaveProperty("sourceChapterIds");
    expect(multi).not.toHaveProperty("sourceStageId");

    const full = byId.get(FS_QUIZ)!;
    expect(full.sourceScope).toBe("FULL_CURRICULUM");
    expect(full.sourceStage).toEqual({ id: fx.stageId, title: "E2E QV Stage A" });
    expect(full).not.toHaveProperty("sourceChapterIds");
    expect(full).not.toHaveProperty("sourceStageId");
  });
});

describe("source scope — student attempt/result flow works for all three scopes", () => {
  for (const [label, quizId, questionId] of [
    ["SINGLE_CHAPTER", SS_QUIZ, SS_Q],
    ["MULTI_CHAPTER", MS_QUIZ, MS_Q],
    ["FULL_CURRICULUM", FS_QUIZ, FS_Q],
  ] as const) {
    it(`start → submit → result for ${label}`, async () => {
      const started = await attemptsService.startAttempt(quizId, fx.student2Id);
      expect(started.attemptId).toBeTruthy();
      expect(started.questions.map((q) => q.id)).toContain(questionId);

      const submitted = await attemptsService.submitAttempt(
        started.attemptId,
        fx.student2Id,
        { answers: [{ questionId, answer: TF_TRUE }] },
      );
      expect(submitted).toBeTruthy();

      const result = await attemptsService.getAttemptResults(
        started.attemptId,
        fx.student2Id,
      );
      expect(["COMPLETED", "GRADED"]).toContain(result.status);
    });
  }
});
