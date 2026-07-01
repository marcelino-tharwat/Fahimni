import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  finalizeOutcome,
  gradeAttempt,
  optionsToArray,
  roundPercentage,
  validateAnswerFormat,
  type GradableQuestion,
  type QuestionResult,
} from "./auto-grade.js";
import type {
  GradeEssaysInput,
  ResultsQueryInput,
  SubmitAttemptInput,
} from "./attempts.validation.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { QuestionType } from "../../generated/prisma/client.js";

/** Full question data needed to enrich a submission/results response. */
interface ResultQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: unknown;
  correctAnswer: string | null;
  explanation: string | null;
}

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
  /** GET /api/quizzes/student — grouped quiz list for the student quiz page. */
  public async getStudentQuizList(studentId: string) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "ACTIVE", chapter: { deletedAt: null } },
      select: {
        chapterId: true,
        chapter: {
          select: {
            id: true,
            name: true,
            stage: { select: { id: true, name: true } },
            quizzes: {
              where: { status: "PUBLISHED" },
              select: {
                id: true,
                title: true,
                questionCount: true,
                totalPoints: true,
                durationMinutes: true,
                chapterId: true,
              },
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });
    if (enrollments.length === 0) {
      return { totalCount: 0, completedCount: 0, newCount: 0, chapters: [] };
    }

    const allQuizIds = enrollments.flatMap((e) =>
      e.chapter.quizzes.map((q) => q.id),
    );
    if (allQuizIds.length === 0) {
      return { totalCount: 0, completedCount: 0, newCount: 0, chapters: [] };
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId, quizId: { in: allQuizIds } },
      select: { id: true, quizId: true, status: true, score: true, totalPoints: true },
    });
    const attemptByQuiz = new Map(attempts.map((a) => [a.quizId, a]));

    type QuizStatus = "new" | "passed" | "failed" | "pending";
    let totalCount = 0;
    let completedCount = 0;
    let newCount = 0;

    const chapters = enrollments.map((e) => {
      const quizzes = e.chapter.quizzes.map((q) => {
        const attempt = attemptByQuiz.get(q.id);
        let status: QuizStatus;
        let score: number | undefined;
        let retakeAllowed: boolean | undefined;

        if (!attempt) {
          status = "new";
          newCount++;
        } else if (attempt.status === "IN_PROGRESS" || attempt.status === "COMPLETED") {
          status = "pending";
        } else {
          const pct =
            attempt.totalPoints > 0
              ? ((attempt.score ?? 0) / attempt.totalPoints) * 100
              : 0;
          if (pct >= 50) {
            status = "passed";
          } else {
            status = "failed";
            retakeAllowed = true;
          }
          completedCount++;
          score = Math.round(pct);
        }

        totalCount++;

        return {
          id: q.id,
          title: q.title,
          questionCount: q.questionCount,
          points: q.totalPoints,
          durationMinutes: q.durationMinutes,
          difficulty: "medium" as const,
          status,
          attemptId: attempt?.id ?? null,
          ...(score !== undefined ? { score } : {}),
          ...(retakeAllowed !== undefined ? { retakeAllowed } : {}),
        };
      });

      return {
        id: e.chapter.id,
        title: e.chapter.name,
        stage: e.chapter.stage.name,
        quizzes,
        defaultOpen: true,
      };
    });

    return { totalCount, completedCount, newCount, chapters };
  }

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
      // A finished attempt (COMPLETED awaiting essays, or fully GRADED) blocks a
      // new one — "no retakes in MVP" (STORY-48).
      const finished = await prisma.quizAttempt.findFirst({
        where: { quizId, studentId, status: { in: ["COMPLETED", "GRADED"] } },
      });
      if (finished) {
        throw new AppError("You have already attempted this quiz", 409);
      }

      try {
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
      } catch (err) {
        // Concurrency: a simultaneous start won the @@unique([quizId,studentId])
        // race. Recover idempotently instead of leaking a P2002/500: return the
        // racing in-progress attempt (resume), or 409 if it was already finished.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const raced = await prisma.quizAttempt.findFirst({
            where: { quizId, studentId },
            select: { id: true, status: true, startedAt: true, totalPoints: true },
          });
          if (raced && raced.status === "IN_PROGRESS") {
            attempt = raced;
          } else {
            throw new AppError("You have already attempted this quiz", 409);
          }
        } else {
          throw err;
        }
      }
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
        quiz: { select: { status: true, chapterId: true, title: true } },
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
      select: {
        id: true,
        type: true,
        text: true,
        options: true,
        correctAnswer: true,
        points: true,
        sortOrder: true,
        explanation: true,
      },
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

    return this.toSubmissionResponse(
      attemptId,
      attempt.quizId,
      attempt.quiz.title,
      status,
      outcome.results,
      questions,
    );
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
        quiz: { select: { createdBy: true, title: true } },
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
      select: {
        id: true,
        type: true,
        text: true,
        options: true,
        correctAnswer: true,
        points: true,
        explanation: true,
      },
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

    return this.toSubmissionResponse(
      attemptId,
      attempt.quizId,
      attempt.quiz.title,
      "GRADED",
      newResults,
      questions,
    );
  }

  /**
   * GET /api/attempts/:attemptId — a student re-fetches their own submitted
   * attempt results. Returns the same enriched shape as the submit response so
   * the results page uses one type for both flows (SCRUM-423).
   */
  public async getAttemptResults(attemptId: string, studentId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        quizId: true,
        status: true,
        answers: true,
        quiz: { select: { title: true } },
      },
    });

    if (!attempt) throw new AppError("Attempt not found", 404);
    if (attempt.studentId !== studentId) {
      throw new AppError("This attempt belongs to another student", 403);
    }
    if (attempt.status === "IN_PROGRESS") {
      throw new AppError("Attempt has not been submitted yet", 409);
    }

    const questions = await prisma.question.findMany({
      where: { quizId: attempt.quizId },
      select: {
        id: true,
        type: true,
        text: true,
        options: true,
        correctAnswer: true,
        points: true,
        sortOrder: true,
        explanation: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    const storedResults = (attempt.answers as unknown as QuestionResult[]) ?? [];

    return this.toSubmissionResponse(
      attempt.id,
      attempt.quizId,
      attempt.quiz.title,
      attempt.status,
      storedResults,
      questions,
    );
  }

  // ── STORY-68: teacher results & CSV export ───────────────────────────────

  /**
   * GET /api/quizzes/:quizId/results — all submitted attempts for a quiz the
   * teacher owns, each with score + per-question breakdown. Sortable by score
   * or student name with a deterministic tie-break.
   */
  public async getQuizResults(
    quizId: string,
    teacherId: string,
    query: ResultsQueryInput,
  ) {
    await this.assertQuizOwnership(quizId, teacherId);
    const rows = this.sortResults(await this.fetchResultRows(quizId), query);
    return { quizId, count: rows.length, results: rows };
  }

  /**
   * GET /api/quizzes/:quizId/results/ungraded — only attempts still awaiting
   * essay grading (status COMPLETED ⟺ has pending essays). Oldest first.
   */
  public async getUngradedResults(quizId: string, teacherId: string) {
    await this.assertQuizOwnership(quizId, teacherId);
    const rows = (await this.fetchResultRows(quizId)).filter(
      (r) => r.status === "COMPLETED",
    );
    rows.sort((a, b) => {
      const at = a.submittedAt ? a.submittedAt.getTime() : 0;
      const bt = b.submittedAt ? b.submittedAt.getTime() : 0;
      return at !== bt ? at - bt : a.attemptId.localeCompare(b.attemptId);
    });
    return { quizId, count: rows.length, results: rows };
  }

  /**
   * GET /api/quizzes/:quizId/results/export — results as a CSV string (one row
   * per attempt). Includes a UTF-8 BOM (Arabic-friendly) and CSV-injection
   * guarding. Sorted by student name for a stable export.
   */
  public async buildResultsCsv(quizId: string, teacherId: string): Promise<string> {
    await this.assertQuizOwnership(quizId, teacherId);
    const rows = this.sortResults(await this.fetchResultRows(quizId), {
      sortBy: "studentName",
      sortOrder: "asc",
    });

    const header = [
      "Student Name",
      "Status",
      "Score",
      "Total Points",
      "Percentage",
      "Pending Essays",
      "Submitted At",
    ];
    const lines = [
      header,
      ...rows.map((r) => [
        r.studentName,
        r.status,
        String(r.score),
        String(r.totalPoints),
        String(r.percentage),
        String(r.pendingEssayCount),
        r.submittedAt ? r.submittedAt.toISOString() : "",
      ]),
    ];

    const body = lines
      .map((cols) => cols.map((c) => this.escapeCsv(c)).join(","))
      .join("\r\n");
    return `﻿${body}\r\n`;
  }

  /** Verify the quiz exists and is owned by this teacher. */
  private async assertQuizOwnership(quizId: string, teacherId: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, createdBy: true },
    });
    if (!quiz) throw new AppError("Quiz not found", 404);
    if (quiz.createdBy !== teacherId) {
      throw new AppError("You do not own this quiz", 403);
    }
    return quiz;
  }

  /** Load submitted attempts + questions and map to result rows. */
  private async fetchResultRows(quizId: string) {
    const [questions, attempts] = await Promise.all([
      prisma.question.findMany({
        where: { quizId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, type: true, points: true, sortOrder: true },
      }),
      prisma.quizAttempt.findMany({
        where: { quizId, status: { in: ["COMPLETED", "GRADED"] } },
        select: {
          id: true,
          studentId: true,
          status: true,
          score: true,
          totalPoints: true,
          completedAt: true,
          answers: true,
          student: { select: { fullName: true } },
        },
      }),
    ]);

    return attempts.map((a) => {
      const stored = (a.answers as unknown as QuestionResult[]) ?? [];
      const byQuestion = new Map(stored.map((r) => [r.questionId, r]));
      const breakdown = questions.map((q) => {
        const r = byQuestion.get(q.id);
        return {
          questionId: q.id,
          questionText: q.text,
          type: q.type,
          result: r?.result ?? "pending",
          awardedPoints: r?.awardedPoints ?? null,
          maxPoints: q.points,
          ...(r?.feedback ? { feedback: r.feedback } : {}),
        };
      });
      const score =
        a.score ?? stored.reduce((s, r) => s + (r.awardedPoints ?? 0), 0);
      const pendingEssayCount = stored.filter(
        (r) => r.result === "pending",
      ).length;

      return {
        attemptId: a.id,
        studentId: a.studentId,
        studentName: a.student.fullName,
        status: a.status,
        score,
        totalPoints: a.totalPoints,
        percentage: roundPercentage(score, a.totalPoints),
        pendingEssayCount,
        submittedAt: a.completedAt,
        questions: breakdown,
      };
    });
  }

  /** Sort result rows with a fully deterministic order. */
  private sortResults<
    T extends { score: number; studentName: string; attemptId: string },
  >(rows: T[], query: ResultsQueryInput): T[] {
    const sortBy = query.sortBy ?? "score";
    const sortOrder =
      query.sortOrder ?? (sortBy === "score" ? "desc" : "asc");
    const dir = sortOrder === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const primary =
        sortBy === "studentName"
          ? a.studentName.localeCompare(b.studentName, "ar")
          : a.score - b.score;
      if (primary !== 0) return primary * dir;
      // Deterministic tie-breakers regardless of direction.
      const nameCmp = a.studentName.localeCompare(b.studentName, "ar");
      if (nameCmp !== 0) return nameCmp;
      return a.attemptId.localeCompare(b.attemptId);
    });
  }

  /** CSV-escape a cell, guarding against CSV/formula injection. */
  private escapeCsv(value: string): string {
    let v = value ?? "";
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    if (/[",\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  /**
   * Submission / grading / results response. Enriched with the question text,
   * options, the student's answer and the correct answer so the student results
   * page can render a full review (SCRUM-423). This is shown only AFTER
   * submission — `correctAnswer` is never exposed during an in-progress attempt
   * (see startAttempt / studentQuestionPublicFields).
   */
  private toSubmissionResponse(
    attemptId: string,
    quizId: string,
    quizTitle: string,
    status: string,
    results: QuestionResult[],
    questions: ResultQuestion[],
  ) {
    const outcome = finalizeOutcome(results);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    return {
      attemptId,
      quizId,
      quizTitle,
      status,
      score: outcome.score,
      totalPoints: outcome.totalPoints,
      percentage: outcome.percentage,
      pendingEssayCount: outcome.pendingEssayCount,
      isFinal: outcome.isFinal,
      results: results.map((r) => {
        const question = questionMap.get(r.questionId);
        return {
          questionId: r.questionId,
          type: r.type,
          questionText: question?.text ?? "",
          options: question ? optionsToArray(question.options) : null,
          studentAnswer: r.answer,
          correctAnswer: question?.correctAnswer ?? null,
          result: r.result,
          awardedPoints: r.awardedPoints,
          maxPoints: r.maxPoints,
          ...(r.feedback ? { feedback: r.feedback } : {}),
          ...(question?.explanation ? { explanation: question.explanation } : {}),
        };
      }),
    };
  }
}

export const attemptsService = new AttemptsService();
