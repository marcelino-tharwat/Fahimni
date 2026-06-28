import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { AppError } from "../../../shared/utils/AppError.js";
import { okResponse } from "../../../shared/utils/apiResponse.js";
import { logger } from "../../../config/logger.js";
import { env } from "../../../config/env.js";
import {
  aiTutorService,
  type AiTutorService,
  type TutorAskOptions,
  type TutorAnswer,
} from "./ai-tutor.service.js";
import { tutorUsageService, type TutorUsageService } from "./tutor-usage.service.js";
import { EnrollmentService } from "../../enrollment/enrollment.service.js";
import {
  TutorNotEnrolledError,
  TutorDailyLimitError,
  TutorTimeoutError,
  TutorUnavailableError,
} from "./ai-tutor.errors.js";
import { TUTOR_NOT_FOUND_MESSAGE } from "../gemini/prompts/tutor-prompt.js";

const ANSWER_PREVIEW_LENGTH = 160;

/**
 * Endpoint-specific budget kept strictly under the 20s STORY-64 target without
 * touching STORY-63 defaults (25s) used by any other consumer.
 *   retrieval ≤ 11s + generation ≤ 7s ⇒ hard endpoint deadline 18s.
 */
const ENDPOINT_ASK_OPTIONS: TutorAskOptions = {
  totalTimeoutMs: 18_000,
  retrievalTimeoutMs: 11_000,
  geminiTimeoutMs: 7_000,
};

interface TutorControllerDeps {
  tutorService?: Pick<AiTutorService, "ask">;
  usageService?: Pick<TutorUsageService, "utcDateString" | "tryClaim" | "refund">;
  enrollmentService?: Pick<EnrollmentService, "hasActiveEnrollment">;
  dailyLimit?: number;
  askOptions?: TutorAskOptions;
}

/**
 * STORY-64 — thin controller for POST /api/tutor/ask. Orchestrates existing
 * services only: enrollment guard → atomic daily-quota claim → reuse
 * AiTutorService.ask → map to the public response → structured logging. No
 * embedding/SQL/prompt/citation logic lives here.
 */
export class TutorController {
  private readonly tutorService: Pick<AiTutorService, "ask">;
  private readonly usageService: Pick<
    TutorUsageService,
    "utcDateString" | "tryClaim" | "refund"
  >;
  private readonly enrollmentService: Pick<
    EnrollmentService,
    "hasActiveEnrollment"
  >;
  private readonly dailyLimit: number;
  private readonly askOptions: TutorAskOptions;

  constructor(deps: TutorControllerDeps = {}) {
    this.tutorService = deps.tutorService ?? aiTutorService;
    this.usageService = deps.usageService ?? tutorUsageService;
    this.enrollmentService = deps.enrollmentService ?? new EnrollmentService();
    this.dailyLimit = deps.dailyLimit ?? env.AI_TUTOR_DAILY_QUERY_LIMIT;
    this.askOptions = deps.askOptions ?? ENDPOINT_ASK_OPTIONS;
  }

  ask = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const startedAt = Date.now();

      // Identity comes only from the authenticated token (set by middleware).
      const studentId = req.user?.id;
      if (!studentId) {
        throw new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        );
      }

      // Question is already trimmed + length-validated by the DTO middleware.
      const { question } = req.body as { question: string };

      // 1. Enrollment precondition (401). No tutor/Gemini work when not enrolled.
      const enrolled =
        await this.enrollmentService.hasActiveEnrollment(studentId);
      if (!enrolled) {
        throw new TutorNotEnrolledError();
      }

      // 2. Atomic daily-quota claim (429 if exceeded).
      const usageDate = this.usageService.utcDateString();
      const allowed = await this.usageService.tryClaim(
        studentId,
        this.dailyLimit,
        usageDate,
      );
      if (!allowed) {
        throw new TutorDailyLimitError();
      }

      // 3. Reuse the STORY-63 service under the endpoint budget.
      let result: TutorAnswer;
      try {
        result = await this.tutorService.ask(
          question,
          studentId,
          this.askOptions,
        );
      } catch (error) {
        // Reversible/transient failures must not permanently consume quota.
        if (
          error instanceof TutorTimeoutError ||
          error instanceof TutorUnavailableError
        ) {
          await this.usageService
            .refund(studentId, usageDate)
            .catch(() => undefined);
        }
        this.logFailure(studentId, question, startedAt, error);
        throw error;
      }

      // 4. Public response mapping — drop internal relevanceScore.
      const citations = result.citations.map((c) => ({
        lessonId: c.lessonId,
        lessonTitle: c.lessonTitle,
        chapterName: c.chapterName,
      }));

      const isNotFound =
        citations.length === 0 &&
        (result.answer === TUTOR_NOT_FOUND_MESSAGE.ar ||
          result.answer === TUTOR_NOT_FOUND_MESSAGE.en);

      // 5. Structured audit log (question required by AC; no secrets/chunks/prompt).
      logger.info("ai_tutor_question_answered", {
        studentId,
        question,
        answerPreview: this.preview(result.answer),
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        citationCount: citations.length,
        resultType: isNotFound ? "not_found" : "answered",
      });

      res
        .status(200)
        .json(okResponse("تمت الإجابة على سؤالك.", {
          answer: result.answer,
          citations,
        }));
    },
  );

  /** Bounded, single-line preview that never splits a code point. */
  private preview(answer: string): string {
    const oneLine = answer.replace(/\s+/g, " ").trim();
    return [...oneLine].slice(0, ANSWER_PREVIEW_LENGTH).join("");
  }

  private logFailure(
    studentId: string,
    question: string,
    startedAt: number,
    error: unknown,
  ): void {
    logger.warn("ai_tutor_question_failed", {
      studentId,
      questionLength: typeof question === "string" ? question.length : 0,
      failureType: error instanceof Error ? error.name : "Unknown",
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }
}
