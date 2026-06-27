import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  finalizeOutcome,
  gradeAttempt,
  validateAnswerFormat,
  type GradableQuestion,
  type QuestionResult,
} from "./auto-grade.js";
import type { GradeEssaysInput, SubmitAttemptInput } from "./attempts.validation.js";
import type { Prisma } from "../../generated/prisma/client.js";

interface SafeQuestion {
  id: string;
  type: GradableQuestion["type"];
  content: string;
  options: unknown;
  points: number;
  sortOrder: number;
}

export type AttemptState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "GRADED";

export class AttemptsService {
  /** GET /api/quizzes/assigned — published quizzes for the student's enrolled chapters. */
  public async getAssignedQuizzes(studentId: string) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "ACTIVE", chapter: { deletedAt: null } },
      select: { chapterId: true },
    });
    const chapterIds = enrollments.map((e) => e.chapterId);
    if (chapterIds.length === 0) return [];

    const quizzes = await prisma.quiz.findMany({
      where: { chapterId: { in: chapterIds }, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        description: true,
        chapterId: true,
        questionCount: true,
        totalPoints: true,
        publishedAt: true,
        createdAt: true,
        _count: { select: { questions: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
    if (quizzes.length === 0) return [];

    // Single query for this student's attempts across all listed quizzes (no N+1).
    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId, quizId: { in: quizzes.map((q) => q.id) } },
      select: { quizId: true, status: true },
    });
    const stateByQuiz = new Map(attempts.map((a) => [a.quizId, a.status]));

    return quizzes.map((q) => {
      const { _count, ...rest } = q;
      return {
        ...rest,
        questionCount: _count.questions,
        attemptStatus: (stateByQuiz.get(q.id) ?? "NOT_STARTED") as AttemptState,
      };
    });
  }

  /** POST /api/quizzes/:id/attempt — start a single attempt. */
  public async startAttempt(quizId: string, studentId: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        status: true,
        chapterId: true,
        chapter: { select: { deletedAt: true } },
        _count: { select: { questions: true } },
      },
    });

    // Drafts / unassigned / deleted-chapter quizzes are hidden from students.
    if (
      !quiz ||
      quiz.status !== "PUBLISHED" ||
      !quiz.chapterId ||
      quiz.chapter?.deletedAt
    ) {
      throw new AppError("Quiz not found", 404);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_chapterId: { studentId, chapterId: quiz.chapterId } },
      select: { status: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new AppError("You are not enrolled in this chapter", 403);
    }

    if (quiz._count.questions === 0) {
      throw new AppError("Quiz has no questions", 400);
    }

    const questions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, type: true, text: true, options: true, points: true, sortOrder: true },
    });
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);

    let attempt;
    // If there's already an IN_PROGRESS attempt, return it (handles Strict Mode
    // double-mount, page refresh, and accidental re-entry).
    const existing = await prisma.quizAttempt.findFirst({
      where: { quizId, studentId, status: "IN_PROGRESS" },
      select: { id: true, status: true, startedAt: true, totalPoints: true },
    });
    if (existing) {
      attempt = existing;
    } else {
      // COMPLETED attempt blocks a new one
      const completed = await prisma.quizAttempt.findFirst({
        where: { quizId, studentId, status: "COMPLETED" },
      });
      if (completed) {
        throw new AppError("You have already attempted this quiz", 409);
      }

      attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          studentId,
          answers: [] as unknown as Prisma.InputJsonValue,
          status: "IN_PROGRESS",
          score: null,
          totalPoints,
          startedAt: new Date(),
        },
        select: { id: true, status: true, startedAt: true, totalPoints: true },
      });
    }

    const safeQuestions: SafeQuestion[] = questions.map((q) => ({
      id: q.id,
      type: q.type,
      content: q.text,
      options: q.options,
      points: q.points,
      sortOrder: q.sortOrder,
    }));

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      totalPoints: attempt.totalPoints,
      durationMinutes: quiz.durationMinutes,
      quiz: { id: quiz.id, title: quiz.title, description: quiz.description },
      questions: safeQuestions,
    };
  }

  /** POST /api/attempts/:attemptId/submit — submit all answers, auto-grade. */
  public async submitAttempt(
    attemptId: string,
    studentId: string,
    input: SubmitAttemptInput,
  ) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        status: true,
        quizId: true,
        quiz: { select: { status: true, chapterId: true } },
      },
    });

    if (!attempt) throw new AppError("Attempt not found", 404);
    if (attempt.studentId !== studentId) {
      throw new AppError("This attempt belongs to another student", 403);
    }
    if (attempt.status !== "IN_PROGRESS") {
      throw new AppError("Attempt has already been submitted", 409);
    }
    if (attempt.quiz.status !== "PUBLISHED") {
      throw new AppError("Quiz is no longer available", 409);
    }
    if (!attempt.quiz.chapterId) {
      throw new AppError("Quiz is no longer available", 409);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_chapterId: { studentId, chapterId: attempt.quiz.chapterId },
      },
      select: { status: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new AppError("You are not enrolled in this chapter", 403);
    }

    const questions = await prisma.question.findMany({
      where: { quizId: attempt.quizId },
      select: { id: true, type: true, options: true, correctAnswer: true, points: true, sortOrder: true },
    });

    // Exact set-equality: every quiz question answered, nothing extra/unknown.
    const questionIds = new Set(questions.map((q) => q.id));
    const submittedIds = new Set(input.answers.map((a) => a.questionId));
    if (
      submittedIds.size !== questionIds.size ||
      [...submittedIds].some((id) => !questionIds.has(id))
    ) {
      throw new AppError(
        "All quiz questions must be answered exactly once",
        400,
      );
    }

    const answerById = new Map(input.answers.map((a) => [a.questionId, a.answer]));

    // Per-answer format validation (throws 400 on invalid MCQ option / TF value).
    for (const q of questions) {
      validateAnswerFormat(q as GradableQuestion, answerById.get(q.id) ?? "");
    }

    const outcome = gradeAttempt(questions as GradableQuestion[], answerById);
    const status = outcome.isFinal ? "GRADED" : "COMPLETED";

    // Atomic, conditional update — only a still-IN_PROGRESS attempt is written.
    const updated = await prisma.quizAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        answers: outcome.results as unknown as Prisma.InputJsonValue,
        score: outcome.score,
        totalPoints: outcome.totalPoints,
        status,
        completedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new AppError("Attempt has already been submitted", 409);
    }

    return this.toSubmissionResponse(attemptId, attempt.quizId, status, outcome.results);
  }

  /** POST /api/attempts/:attemptId/grade-essays — teacher grades pending essays. */
  public async gradeEssays(
    attemptId: string,
    teacherId: string,
    input: GradeEssaysInput,
  ) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        quizId: true,
        answers: true,
        quiz: { select: { createdBy: true } },
      },
    });

    if (!attempt) throw new AppError("Attempt not found", 404);
    if (attempt.quiz.createdBy !== teacherId) {
      throw new AppError("You do not own this quiz", 403);
    }
    if (attempt.status === "GRADED") {
      throw new AppError("Attempt has already been graded", 409);
    }
    if (attempt.status !== "COMPLETED") {
      throw new AppError("Attempt is not awaiting essay grading", 409);
    }

    const questions = await prisma.question.findMany({
      where: { quizId: attempt.quizId },
      select: { id: true, type: true, points: true },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    const storedResults = (attempt.answers as unknown as QuestionResult[]) ?? [];
    const pendingEssayIds = new Set(
      storedResults.filter((r) => r.result === "pending").map((r) => r.questionId),
    );

    const gradeIds = new Set(input.grades.map((g) => g.questionId));

    // Every supplied grade must target a pending essay question…
    for (const g of input.grades) {
      const q = qMap.get(g.questionId);
      if (!q || q.type !== "ESSAY" || !pendingEssayIds.has(g.questionId)) {
        throw new AppError(
          "Grades may only target pending essay questions",
          400,
        );
      }
      if (g.awardedPoints > q.points) {
        throw new AppError(
          "awardedPoints must not exceed the question's points",
          400,
        );
      }
    }
    // …and every pending essay must be graded (no partial grading).
    if (gradeIds.size !== pendingEssayIds.size) {
      throw new AppError("All pending essay questions must be graded", 400);
    }

    const gradeByQuestion = new Map(input.grades.map((g) => [g.questionId, g]));
    const newResults: QuestionResult[] = storedResults.map((r) => {
      if (r.result !== "pending") return r;
      const g = gradeByQuestion.get(r.questionId)!;
      return {
        ...r,
        awardedPoints: g.awardedPoints,
        feedback: g.feedback ?? null,
        result: "graded",
      };
    });

    const outcome = finalizeOutcome(newResults);

    const updated = await prisma.quizAttempt.updateMany({
      where: { id: attemptId, status: "COMPLETED" },
      data: {
        answers: newResults as unknown as Prisma.InputJsonValue,
        score: outcome.score,
        totalPoints: outcome.totalPoints,
        status: "GRADED",
        completedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new AppError("Attempt has already been graded", 409);
    }

    return this.toSubmissionResponse(attemptId, attempt.quizId, "GRADED", newResults);
  }

  /** Safe submission/grading response — never exposes correctAnswer. */
  private toSubmissionResponse(
    attemptId: string,
    quizId: string,
    status: string,
    results: QuestionResult[],
  ) {
    const outcome = finalizeOutcome(results);
    return {
      attemptId,
      quizId,
      status,
      score: outcome.score,
      totalPoints: outcome.totalPoints,
      percentage: outcome.percentage,
      pendingEssayCount: outcome.pendingEssayCount,
      isFinal: outcome.isFinal,
      results: results.map((r) => ({
        questionId: r.questionId,
        result: r.result,
        awardedPoints: r.awardedPoints,
        maxPoints: r.maxPoints,
        ...(r.feedback ? { feedback: r.feedback } : {}),
      })),
    };
  }
}

export const attemptsService = new AttemptsService();
