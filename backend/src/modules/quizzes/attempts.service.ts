import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  countStatuses,
  deriveEssayGradingStatus,
  essayResultsFromStored,
  essayScoreSummary,
  type EssayGradingStatus,
} from "./essay-grading.js";
import {
  finalizeOutcome,
  gradeAttempt,
  optionsToArray,
  roundPercentage,
  validateAnswerFormat,
  type GradableQuestion,
  type QuestionResult,
} from "./auto-grade.js";
import {
  draftItemsToArray,
  emptyDraftPayload,
  mergeDraftItems,
  parseDraftAnswers,
  type DraftAnswerItem,
} from "./attempt-draft.js";
import {
  buildAttemptTimingResponse,
  computeExpiresAt,
  isAttemptExpired,
  resolveQuizDurationMinutes,
} from "./attempt-timing.js";
import type {
  GradeEssaysInput,
  EssayGradingListQueryInput,
  ResultsQueryInput,
  SaveDraftAnswersInput,
  SubmitAttemptInput,
} from "./attempts.validation.js";
import {
  canStartProgressionQuiz,
  findGateLessonForQuiz,
} from "../progression/lesson-progression.js";
import { loadChapterProgressionContext } from "../progression/progression-context.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { QuestionType, AttemptSubmissionReason } from "../../generated/prisma/client.js";

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
          attemptStatus: attempt?.status ?? null,
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
    const accessLog = { studentId, quizId };
    logger.info("quiz_access_check_started", accessLog);

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

    if (!quiz) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        safeReasonCode: "QUIZ_NOT_FOUND",
      });
      throw new AppError("Quiz not found", 404, "QUIZ_NOT_FOUND");
    }

    if (!quiz.chapterId) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        safeReasonCode: "QUIZ_NOT_FOUND",
      });
      throw new AppError("Quiz not found", 404, "QUIZ_NOT_FOUND");
    }

    if (quiz.chapter?.deletedAt) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        safeReasonCode: "QUIZ_PARENT_UNAVAILABLE",
      });
      throw new AppError(
        "Quiz not found",
        404,
        "QUIZ_PARENT_UNAVAILABLE",
      );
    }

    if (quiz.status !== "PUBLISHED") {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        quizPublished: false,
        safeReasonCode: "QUIZ_NOT_PUBLISHED",
      });
      throw new AppError("Quiz is not published", 403, "QUIZ_NOT_PUBLISHED");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_chapterId: { studentId, chapterId: quiz.chapterId } },
      select: { status: true },
    });
    if (!enrollment) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        enrollmentFound: false,
        safeReasonCode: "ENROLLMENT_REQUIRED",
      });
      throw new AppError(
        "You are not enrolled in this chapter",
        403,
        "ENROLLMENT_REQUIRED",
      );
    }
    if (enrollment.status !== "ACTIVE") {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        enrollmentFound: true,
        enrollmentStatus: enrollment.status,
        safeReasonCode: "ENROLLMENT_INACTIVE",
      });
      throw new AppError(
        "Your enrollment in this chapter is not active",
        403,
        "ENROLLMENT_INACTIVE",
      );
    }

    const chapterRecord = await prisma.chapter.findUnique({
      where: { id: quiz.chapterId },
      select: { price: true },
    });
    const chapterPrice =
      chapterRecord?.price !== null && chapterRecord?.price !== undefined
        ? Number(chapterRecord.price)
        : null;
    const progressionCtx = await loadChapterProgressionContext(
      studentId,
      quiz.chapterId,
      chapterPrice,
    );
    const gateLessonId = findGateLessonForQuiz(quizId, progressionCtx.lessons);
    const progressionStart = canStartProgressionQuiz(
      quizId,
      gateLessonId,
      progressionCtx,
    );
    if (!progressionStart.allowed) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        gateLessonId,
        safeReasonCode: progressionStart.code,
      });
      throw new AppError(
        "Complete the prerequisite lesson before starting this quiz",
        403,
        progressionStart.code ?? "QUIZ_PREREQUISITE_LESSON_INCOMPLETE",
      );
    }

    if (quiz._count.questions === 0) {
      logger.warn("quiz_access_check_denied", {
        ...accessLog,
        chapterId: quiz.chapterId,
        safeReasonCode: "QUIZ_NO_QUESTIONS",
      });
      throw new AppError("Quiz has no questions", 400, "QUIZ_NO_QUESTIONS");
    }

    const questions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, type: true, text: true, options: true, points: true, sortOrder: true },
    });
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);

    let durationSnapshot: number;
    try {
      durationSnapshot = resolveQuizDurationMinutes(quiz.durationMinutes);
    } catch (err) {
      if (err instanceof AppError && err.code === "QUIZ_DURATION_NOT_CONFIGURED") {
        logger.warn("quiz_access_check_denied", {
          ...accessLog,
          chapterId: quiz.chapterId,
          safeReasonCode: "QUIZ_DURATION_NOT_CONFIGURED",
        });
      }
      throw err;
    }

    const serverNow = new Date();

    let attempt;
    let resumed = false;
    const existing = await prisma.quizAttempt.findFirst({
      where: { quizId, studentId, status: "IN_PROGRESS" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        totalPoints: true,
        answers: true,
        durationMinutesSnapshot: true,
        expiresAt: true,
        lastSavedAt: true,
      },
    });

    if (existing) {
      if (
        isAttemptExpired(existing.expiresAt, serverNow) ||
        (existing.expiresAt == null && existing.durationMinutesSnapshot != null)
      ) {
        if (existing.expiresAt == null && existing.durationMinutesSnapshot != null) {
          const backfillExpires = computeExpiresAt(
            existing.startedAt,
            existing.durationMinutesSnapshot,
          );
          if (isAttemptExpired(backfillExpires, serverNow)) {
            await this.finalizeInProgressAttempt(
              existing.id,
              studentId,
              null,
              "TIME_EXPIRED",
            );
            logger.info("quiz_attempt_expired", {
              ...accessLog,
              attemptId: existing.id,
            });
            throw new AppError(
              "Attempt has already been submitted",
              409,
              "ATTEMPT_ALREADY_SUBMITTED",
              { attemptId: existing.id },
            );
          }
        } else if (isAttemptExpired(existing.expiresAt, serverNow)) {
          await this.finalizeInProgressAttempt(
            existing.id,
            studentId,
            null,
            "TIME_EXPIRED",
          );
          logger.info("quiz_attempt_expired", {
            ...accessLog,
            attemptId: existing.id,
          });
          throw new AppError(
            "Attempt has already been submitted",
            409,
            "ATTEMPT_ALREADY_SUBMITTED",
            { attemptId: existing.id },
          );
        }
      }
      const snap = existing.durationMinutesSnapshot ?? durationSnapshot;
      const exp =
        existing.expiresAt ?? computeExpiresAt(existing.startedAt, snap);
      if (
        existing.durationMinutesSnapshot == null ||
        existing.expiresAt == null
      ) {
        await prisma.quizAttempt.update({
          where: { id: existing.id },
          data: { durationMinutesSnapshot: snap, expiresAt: exp },
        });
      }
      attempt = {
        ...existing,
        durationMinutesSnapshot: snap,
        expiresAt: exp,
      };
      resumed = true;
    } else {
      // A finished attempt (COMPLETED awaiting essays, or fully GRADED) blocks a
      // new one — "no retakes in MVP" (STORY-48).
      const finished = await prisma.quizAttempt.findFirst({
        where: { quizId, studentId, status: { in: ["COMPLETED", "GRADED"] } },
        select: { id: true },
      });
      if (finished) {
        logger.warn("quiz_access_check_denied", {
          ...accessLog,
          chapterId: quiz.chapterId,
          attemptId: finished.id,
          safeReasonCode: "ATTEMPT_ALREADY_SUBMITTED",
        });
        throw new AppError(
          "You have already attempted this quiz",
          409,
          "ATTEMPT_ALREADY_SUBMITTED",
          { attemptId: finished.id },
        );
      }

      try {
        const startedAt = serverNow;
        const expiresAt = computeExpiresAt(startedAt, durationSnapshot);
        attempt = await prisma.quizAttempt.create({
          data: {
            quizId,
            studentId,
            answers: emptyDraftPayload() as unknown as Prisma.InputJsonValue,
            status: "IN_PROGRESS",
            score: null,
            totalPoints,
            startedAt,
            durationMinutesSnapshot: durationSnapshot,
            expiresAt,
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            totalPoints: true,
            answers: true,
            durationMinutesSnapshot: true,
            expiresAt: true,
            lastSavedAt: true,
          },
        });
        logger.info("quiz_attempt_created", {
          ...accessLog,
          attemptId: attempt.id,
          configuredDurationMinutes: quiz.durationMinutes,
          durationMinutesSnapshot: durationSnapshot,
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
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
            attempt = await prisma.quizAttempt.findFirst({
              where: { id: raced.id },
              select: {
                id: true,
                status: true,
                startedAt: true,
                totalPoints: true,
                answers: true,
                durationMinutesSnapshot: true,
                expiresAt: true,
                lastSavedAt: true,
              },
            });
            resumed = true;
          } else if (raced) {
            throw new AppError(
              "You have already attempted this quiz",
              409,
              "ATTEMPT_ALREADY_SUBMITTED",
              { attemptId: raced.id },
            );
          } else {
            throw new AppError("You have already attempted this quiz", 409, "ATTEMPT_ALREADY_SUBMITTED");
          }
        } else {
          throw err;
        }
      }
    }

    if (!attempt) {
      throw new AppError("Failed to start attempt", 500);
    }

    logger.info("quiz_access_check_allowed", {
      ...accessLog,
      chapterId: quiz.chapterId,
      attemptId: attempt.id,
      enrollmentFound: true,
      enrollmentStatus: "ACTIVE",
    });
    if (resumed) {
      logger.info("quiz_attempt_resumed", {
        ...accessLog,
        attemptId: attempt.id,
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

    const snapshot =
      attempt.durationMinutesSnapshot ?? durationSnapshot;
    const expiresAt =
      attempt.expiresAt ?? computeExpiresAt(attempt.startedAt, snapshot);
    const savedAnswers = draftItemsToArray(attempt.answers);

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      status: attempt.status,
      totalPoints: attempt.totalPoints,
      ...buildAttemptTimingResponse(attempt.startedAt, snapshot, expiresAt),
      savedAnswers,
      lastSavedAt: attempt.lastSavedAt?.toISOString() ?? null,
      quiz: { id: quiz.id, title: quiz.title, description: quiz.description },
      questions: safeQuestions,
    };
  }

  /** PATCH /api/attempts/:attemptId/answers — persist draft answers before submit. */
  public async saveDraftAnswers(
    attemptId: string,
    studentId: string,
    input: SaveDraftAnswersInput,
  ) {
    const attempt = await this.loadOwnedInProgressAttempt(attemptId, studentId);

    if (isAttemptExpired(attempt.expiresAt)) {
      throw new AppError("Attempt time has expired", 409, "ATTEMPT_EXPIRED");
    }

    const questions = await prisma.question.findMany({
      where: { quizId: attempt.quizId },
      select: { id: true, type: true, options: true, points: true, sortOrder: true },
    });
    const questionIds = new Set(questions.map((q) => q.id));

    for (const item of input.answers) {
      if (!questionIds.has(item.questionId)) {
        throw new AppError("Question does not belong to this quiz", 400, "INVALID_QUESTION");
      }
      const q = questions.find((x) => x.id === item.questionId)!;
      if (item.answer.trim().length > 0) {
        validateAnswerFormat(q as GradableQuestion, item.answer);
      }
    }

    const merged = mergeDraftItems(attempt.answers, input.answers);
    const lastSavedAt = new Date();
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        answers: merged as unknown as Prisma.InputJsonValue,
        lastSavedAt,
      },
    });

    logger.info("quiz_answer_draft_saved", {
      studentId,
      quizId: attempt.quizId,
      attemptId,
      answeredQuestionCount: merged.items.length,
    });

    return { lastSavedAt: lastSavedAt.toISOString(), savedCount: merged.items.length };
  }

  /** POST /api/attempts/:attemptId/submit — submit all answers, auto-grade. */
  public async submitAttempt(
    attemptId: string,
    studentId: string,
    input: SubmitAttemptInput,
  ) {
    const finished = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, studentId: true, status: true },
    });
    if (!finished) {
      throw new AppError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");
    }
    if (finished.studentId !== studentId) {
      throw new AppError("This attempt belongs to another student", 403);
    }
    if (finished.status !== "IN_PROGRESS") {
      logger.info("quiz_attempt_already_finalized", {
        studentId,
        attemptId,
        status: finished.status,
      });
      return this.getAttemptResults(attemptId, studentId);
    }

    const attempt = await this.loadOwnedInProgressAttempt(attemptId, studentId);
    const timedOut = isAttemptExpired(attempt.expiresAt);
    const reason: AttemptSubmissionReason = timedOut ? "TIME_EXPIRED" : "MANUAL";

    return this.finalizeInProgressAttempt(
      attemptId,
      studentId,
      input,
      reason,
    );
  }

  private async loadOwnedInProgressAttempt(attemptId: string, studentId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        status: true,
        quizId: true,
        answers: true,
        expiresAt: true,
        quiz: { select: { status: true, chapterId: true, title: true } },
      },
    });

    if (!attempt) {
      throw new AppError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");
    }
    if (attempt.studentId !== studentId) {
      throw new AppError("This attempt belongs to another student", 403);
    }
    if (attempt.status !== "IN_PROGRESS") {
      throw new AppError("Attempt has already been submitted", 409, "ATTEMPT_ALREADY_SUBMITTED");
    }
    if (attempt.quiz.status !== "PUBLISHED" || !attempt.quiz.chapterId) {
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

    return attempt;
  }

  private async finalizeInProgressAttempt(
    attemptId: string,
    studentId: string,
    input: SubmitAttemptInput | null,
    submissionReason: AttemptSubmissionReason,
  ) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        status: true,
        quizId: true,
        answers: true,
        expiresAt: true,
        quiz: { select: { status: true, chapterId: true, title: true } },
      },
    });

    if (!attempt) {
      throw new AppError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");
    }
    if (attempt.studentId !== studentId) {
      throw new AppError("This attempt belongs to another student", 403);
    }
    if (attempt.status !== "IN_PROGRESS") {
      logger.info("quiz_attempt_already_finalized", {
        studentId,
        attemptId,
        status: attempt.status,
      });
      return this.getAttemptResults(attemptId, studentId);
    }

    const timedOut =
      submissionReason === "TIME_EXPIRED" ||
      isAttemptExpired(attempt.expiresAt);
    const effectiveReason: AttemptSubmissionReason = timedOut
      ? "TIME_EXPIRED"
      : "MANUAL";

    if (effectiveReason === "TIME_EXPIRED") {
      logger.info("quiz_timer_expired", { studentId, attemptId, quizId: attempt.quizId });
      logger.info("quiz_auto_submit_started", { studentId, attemptId, quizId: attempt.quizId });
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

    const draftMap = parseDraftAnswers(attempt.answers);
    const submittedMap = new Map(
      (input?.answers ?? []).map((a) => [a.questionId, a.answer]),
    );
    const answerById = new Map<string, string>();

    for (const q of questions) {
      const fromSubmit = submittedMap.get(q.id);
      const fromDraft = draftMap.get(q.id);
      const raw = fromSubmit ?? fromDraft ?? "";
      answerById.set(q.id, raw);
    }

    if (effectiveReason === "MANUAL") {
      const questionIds = new Set(questions.map((q) => q.id));
      const submittedIds = new Set((input?.answers ?? []).map((a) => a.questionId));
      if (
        submittedIds.size !== questionIds.size ||
        [...submittedIds].some((id) => !questionIds.has(id))
      ) {
        throw new AppError(
          "All quiz questions must be answered exactly once",
          400,
        );
      }
      for (const q of questions) {
        validateAnswerFormat(q as GradableQuestion, answerById.get(q.id) ?? "");
      }
    } else {
      for (const q of questions) {
        const ans = (answerById.get(q.id) ?? "").trim();
        if (ans.length > 0) {
          validateAnswerFormat(q as GradableQuestion, ans);
        }
      }
    }

    const outcome = gradeAttempt(questions as GradableQuestion[], answerById);
    const status = outcome.isFinal ? "GRADED" : "COMPLETED";

    const updated = await prisma.quizAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        answers: outcome.results as unknown as Prisma.InputJsonValue,
        score: outcome.score,
        totalPoints: outcome.totalPoints,
        status,
        completedAt: new Date(),
        submissionReason: effectiveReason,
      },
    });
    if (updated.count === 0) {
      logger.info("quiz_attempt_already_finalized", { studentId, attemptId });
      return this.getAttemptResults(attemptId, studentId);
    }

    if (effectiveReason === "TIME_EXPIRED") {
      logger.info("quiz_auto_submit_completed", {
        studentId,
        attemptId,
        quizId: attempt.quizId,
        answeredQuestionCount: [...answerById.values()].filter((a) => a.trim()).length,
        unansweredQuestionCount: questions.length - [...answerById.values()].filter((a) => a.trim()).length,
      });
    } else {
      logger.info("quiz_manual_submit_completed", { studentId, attemptId, quizId: attempt.quizId });
    }
    logger.info("quiz_attempt_finalized", {
      studentId,
      attemptId,
      quizId: attempt.quizId,
      submissionReason: effectiveReason,
      status,
    });

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

    logger.info("essay_grading_started", {
      teacherId,
      attemptId,
      quizId: attempt.quizId,
      essayQuestionCount: pendingEssayIds.size,
    });

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

    logger.info("essay_grading_completed", {
      teacherId,
      attemptId,
      quizId: attempt.quizId,
      essayQuestionCount: input.grades.length,
      gradedCount: input.grades.length,
      gradingStatus: "GRADED",
    });

    return this.toSubmissionResponse(
      attemptId,
      attempt.quizId,
      attempt.quiz.title,
      "GRADED",
      newResults,
      questions,
    );
  }

  private static readonly ESSAY_LIST_DEFAULT_LIMIT = 20;
  private static readonly ESSAY_LIST_MAX_LIMIT = 50;

  private resolveListLimit(limit?: number): number {
    const raw = limit ?? AttemptsService.ESSAY_LIST_DEFAULT_LIMIT;
    return Math.min(Math.max(1, raw), AttemptsService.ESSAY_LIST_MAX_LIMIT);
  }

  /** GET /api/quizzes/essay-grading — hub of quizzes with essay submissions. */
  public async getEssayGradingHub(
    teacherId: string,
    query: EssayGradingListQueryInput,
  ) {
    const limit = this.resolveListLimit(query.limit);
    const cursor = query.cursor;

    const quizzes = await prisma.quiz.findMany({
      where: {
        createdBy: teacherId,
        questions: { some: { type: "ESSAY" } },
        attempts: { some: { status: { in: ["COMPLETED", "GRADED"] } } },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true,
        title: true,
        chapter: { select: { name: true } },
        questions: { where: { type: "ESSAY" }, select: { id: true } },
        attempts: {
          where: { status: { in: ["COMPLETED", "GRADED"] } },
          select: { answers: true },
        },
      },
    });

    const hasMore = quizzes.length > limit;
    const page = hasMore ? quizzes.slice(0, limit) : quizzes;

    const data = page.map((quiz) => {
      const essayQuestionCount = quiz.questions.length;
      const submissionStatuses: EssayGradingStatus[] = [];

      for (const attempt of quiz.attempts) {
        const stored = (attempt.answers as unknown as QuestionResult[]) ?? [];
        const essays = essayResultsFromStored(stored);
        if (essays.length === 0) continue;
        submissionStatuses.push(deriveEssayGradingStatus(essays));
      }

      const counts = countStatuses(submissionStatuses);
      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        chapterTitle: quiz.chapter?.name ?? "",
        essayQuestionCount,
        studentSubmissionCount: submissionStatuses.length,
        ...counts,
      };
    });

    logger.info("essay_grading_hub_loaded", {
      teacherId,
      submissionCount: data.reduce((s, q) => s + q.studentSubmissionCount, 0),
      essayQuestionCount: data.reduce((s, q) => s + q.essayQuestionCount, 0),
      gradedCount: data.reduce((s, q) => s + q.gradedCount, 0),
      durationMs: 0,
    });

    return {
      data,
      meta: {
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
        hasMore,
      },
    };
  }

  /** GET /api/quizzes/:quizId/essay-submissions — student essay submissions for a quiz. */
  public async getEssaySubmissions(
    quizId: string,
    teacherId: string,
    query: EssayGradingListQueryInput,
  ) {
    await this.assertQuizOwnership(quizId, teacherId);
    const limit = this.resolveListLimit(query.limit);
    const cursor = query.cursor;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, createdBy: teacherId },
      select: {
        id: true,
        title: true,
        chapter: { select: { name: true } },
        questions: { where: { type: "ESSAY" }, select: { id: true, points: true } },
      },
    });
    if (!quiz) throw new AppError("Quiz not found", 404);

    const essayQuestionCount = quiz.questions.length;
    if (essayQuestionCount === 0) {
      throw new AppError("Quiz has no essay questions", 404);
    }

    const allAttempts = await prisma.quizAttempt.findMany({
      where: { quizId, status: { in: ["COMPLETED", "GRADED"] } },
      select: { answers: true },
    });
    const allStatuses: EssayGradingStatus[] = [];
    for (const a of allAttempts) {
      const stored = (a.answers as unknown as QuestionResult[]) ?? [];
      const essays = essayResultsFromStored(stored);
      if (essays.length > 0) {
        allStatuses.push(deriveEssayGradingStatus(essays));
      }
    }
    const summary = {
      totalStudents: allStatuses.length,
      ...countStatuses(allStatuses),
    };

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        status: { in: ["COMPLETED", "GRADED"] },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true,
        studentId: true,
        status: true,
        completedAt: true,
        answers: true,
        student: { select: { fullName: true } },
      },
    });

    const hasMore = attempts.length > limit;
    const page = hasMore ? attempts.slice(0, limit) : attempts;

    const submissions = page
      .map((a) => {
        const stored = (a.answers as unknown as QuestionResult[]) ?? [];
        const essays = essayResultsFromStored(stored);
        if (essays.length === 0) return null;
        const essaySummary = essayScoreSummary(essays);
        const status = deriveEssayGradingStatus(essays);
        return {
          attemptId: a.id,
          studentId: a.studentId,
          studentName: a.student.fullName,
          essayQuestionCount: essaySummary.essayQuestionCount,
          gradedEssayQuestionCount: essaySummary.gradedEssayQuestionCount,
          status,
          earnedEssayScore: essaySummary.earnedEssayScore,
          maximumEssayScore: essaySummary.maximumEssayScore,
          submittedAt: a.completedAt?.toISOString() ?? null,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    logger.info("essay_submissions_loaded", {
      teacherId,
      quizId,
      submissionCount: submissions.length,
      essayQuestionCount,
      gradedCount: summary.gradedCount,
    });

    return {
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          chapterTitle: quiz.chapter?.name ?? "",
        },
        summary,
        submissions,
      },
      meta: {
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
        hasMore,
      },
    };
  }

  /** GET /api/attempts/:attemptId/essay-grading — teacher grading detail. */
  public async getEssayGradingDetail(attemptId: string, teacherId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        score: true,
        totalPoints: true,
        completedAt: true,
        answers: true,
        quizId: true,
        quiz: {
          select: {
            id: true,
            title: true,
            createdBy: true,
            chapter: { select: { name: true } },
          },
        },
        student: { select: { id: true, fullName: true } },
      },
    });

    if (!attempt) throw new AppError("Attempt not found", 404);
    if (attempt.quiz.createdBy !== teacherId) {
      throw new AppError("Attempt not found", 404);
    }
    if (!["COMPLETED", "GRADED"].includes(attempt.status)) {
      throw new AppError("Attempt is not eligible for essay grading", 409);
    }

    const questions = await prisma.question.findMany({
      where: { quizId: attempt.quizId, type: "ESSAY" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, text: true, points: true, sortOrder: true },
    });

    if (questions.length === 0) {
      throw new AppError("Quiz has no essay questions", 404);
    }

    const stored = (attempt.answers as unknown as QuestionResult[]) ?? [];
    const byQuestion = new Map(stored.map((r) => [r.questionId, r]));
    const essayAnswers = questions.map((q, idx) => {
      const r = byQuestion.get(q.id);
      const awardedPoints = r?.awardedPoints ?? null;
      const gradingStatus: EssayGradingStatus =
        awardedPoints === null ? "PENDING" : "GRADED";
      return {
        questionId: q.id,
        order: idx + 1,
        questionText: q.text,
        studentAnswer: r?.answer ?? "",
        maximumPoints: q.points,
        awardedPoints,
        feedback: r?.feedback ?? null,
        gradingStatus,
      };
    });

    const essays = essayResultsFromStored(stored);
    const gradingStatus = deriveEssayGradingStatus(essays);
    const essaySummary = essayScoreSummary(essays);

    logger.info("essay_grading_detail_loaded", {
      teacherId,
      quizId: attempt.quizId,
      attemptId,
      essayQuestionCount: essaySummary.essayQuestionCount,
      gradedCount: essaySummary.gradedEssayQuestionCount,
      gradingStatus,
    });

    return {
      quiz: {
        id: attempt.quiz.id,
        title: attempt.quiz.title,
        chapterTitle: attempt.quiz.chapter?.name ?? "",
      },
      student: {
        id: attempt.student.id,
        displayName: attempt.student.fullName,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        gradingStatus,
        submittedAt: attempt.completedAt?.toISOString() ?? null,
        earnedScore: attempt.score ?? essaySummary.earnedEssayScore,
        maximumScore: attempt.totalPoints || essaySummary.maximumEssayScore,
      },
      essayAnswers,
    };
  }

  /**
   * GET /api/attempts/:attemptId — a student re-fetches their own submitted
   * attempt results. Returns the same enriched shape as the submit response so
   * the results page uses one type for both flows (SCRUM-423).
   */
  public async getAttemptResults(attemptId: string, studentId: string) {
    let attempt = await prisma.quizAttempt.findUnique({
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
      const row = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        select: { expiresAt: true },
      });
      if (isAttemptExpired(row?.expiresAt)) {
        await this.finalizeInProgressAttempt(
          attemptId,
          studentId,
          null,
          "TIME_EXPIRED",
        );
        attempt = await prisma.quizAttempt.findUnique({
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
        if (!attempt || attempt.status === "IN_PROGRESS") {
          throw new AppError("Attempt has not been submitted yet", 409);
        }
      } else {
        throw new AppError("Attempt has not been submitted yet", 409, "ATTEMPT_NOT_STARTED");
      }
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
        select: { id: true, text: true, type: true, points: true, sortOrder: true, correctAnswer: true },
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
          student: { select: { fullName: true, mobile: true } },
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
          answer: r?.answer ?? "",
          correctAnswer: q.correctAnswer ?? null,
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
        studentMobile: a.student.mobile,
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
