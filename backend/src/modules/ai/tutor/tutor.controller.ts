import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { AppError } from "../../../shared/utils/AppError.js";
import { okResponse } from "../../../shared/utils/apiResponse.js";
import { logger } from "../../../config/logger.js";
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
  TutorTimeoutError,
  TutorUnavailableError,
} from "./ai-tutor.errors.js";
import { TUTOR_NOT_FOUND_MESSAGE } from "../gemini/prompts/tutor-prompt.js";
import { resolveLocale, TUTOR_DAILY_LIMIT_MESSAGE } from "./tutor.i18n.js";

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

type UsageServiceLike = Pick<
  TutorUsageService,
  | "utcDateString"
  | "tryClaim"
  | "refund"
  | "resolveEffectiveLimit"
  | "getToday"
  | "resetsAt"
>;

interface TutorControllerDeps {
  tutorService?: Pick<AiTutorService, "ask">;
  usageService?: UsageServiceLike;
  enrollmentService?: Pick<EnrollmentService, "hasActiveEnrollment">;
  askOptions?: TutorAskOptions;
}

/**
 * STORY-64/65 — thin controller for the AI tutor endpoints. Orchestrates
 * existing services only: enrollment guard → resolve teacher-configured cap →
 * atomic daily-quota claim → reuse AiTutorService.ask → public mapping →
 * structured logging. No embedding/SQL/prompt/citation logic lives here.
 */
export class TutorController {
  private readonly tutorService: Pick<AiTutorService, "ask">;
  private readonly usageService: UsageServiceLike;
  private readonly enrollmentService: Pick<
    EnrollmentService,
    "hasActiveEnrollment"
  >;
  private readonly askOptions: TutorAskOptions;

  constructor(deps: TutorControllerDeps = {}) {
    this.tutorService = deps.tutorService ?? aiTutorService;
    this.usageService = deps.usageService ?? tutorUsageService;
    this.enrollmentService = deps.enrollmentService ?? new EnrollmentService();
    this.askOptions = deps.askOptions ?? ENDPOINT_ASK_OPTIONS;
  }

  /** POST /api/tutor/ask */
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

      // 2. Resolve the teacher-configured effective cap, then atomically claim.
      const limit = await this.usageService.resolveEffectiveLimit(studentId);
      const usageDate = this.usageService.utcDateString();
      const allowed = await this.usageService.tryClaim(
        studentId,
        limit,
        usageDate,
      );
      if (!allowed) {
        return this.respondLimitExceeded(req, res, limit);
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

  /** GET /api/tutor/usage-today — read-only, never increments. */
  usageToday = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user?.id;
      if (!studentId) {
        throw new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        );
      }

      const limit = await this.usageService.resolveEffectiveLimit(studentId);
      const snapshot = await this.usageService.getToday(studentId, limit);

      res.status(200).json(
        okResponse("تم جلب استخدامك اليومي.", {
          used: snapshot.used,
          limit: snapshot.limit,
          remaining: snapshot.remaining,
          resetsAt: snapshot.resetsAt,
        }),
      );
    },
  );

  /** Build the 429 daily-limit response with safe usage metadata. */
  private respondLimitExceeded(req: Request, res: Response, limit: number): void {
    const resetsAt = this.usageService.resetsAt();
    const locale = resolveLocale(req.headers["accept-language"]);
    const retryAfter = Math.max(
      0,
      Math.ceil((Date.parse(resetsAt) - Date.now()) / 1000),
    );
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: TUTOR_DAILY_LIMIT_MESSAGE[locale],
      reason: "DAILY_LIMIT_EXCEEDED",
      limit,
      remaining: 0,
      resetsAt,
    });
  }

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
