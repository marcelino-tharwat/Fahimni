import { AppError } from "../../../shared/utils/AppError.js";

/**
 * STORY-63 — AI Tutor service errors.
 *
 * All extend {@link AppError} so the existing global error pipeline (status
 * mapping, isOperational) keeps working unchanged. They carry a safe `reason`
 * category and never expose prompts, chunks, embeddings, SQL, or raw provider
 * payloads. Note: "no accessible content" is NOT an error — it returns a
 * successful not-found answer (see ai-tutor.service.ts).
 */
export class TutorError extends AppError {
  public readonly reason: string;

  constructor(message: string, statusCode: number, reason: string) {
    super(message, statusCode);
    this.name = "TutorError";
    this.reason = reason;
    Object.setPrototypeOf(this, TutorError.prototype);
  }
}

/** The question is empty, whitespace-only, too long, or otherwise invalid. */
export class TutorValidationError extends TutorError {
  constructor(message: string) {
    super(message, 400, "QUESTION_INVALID");
    this.name = "TutorValidationError";
    Object.setPrototypeOf(this, TutorValidationError.prototype);
  }
}

/** A budget elapsed (total 25s, retrieval 15s, or generation 10s). */
export class TutorTimeoutError extends TutorError {
  constructor(message = "انتهت مهلة معالجة سؤالك قبل اكتمالها.") {
    super(message, 504, "TUTOR_TIMEOUT");
    this.name = "TutorTimeoutError";
    Object.setPrototypeOf(this, TutorTimeoutError.prototype);
  }
}

/** Gemini blocked the request/response via its safety filters. */
export class TutorSafetyBlockedError extends TutorError {
  constructor(message = "تعذّر إنشاء إجابة بسبب قيود أمان المحتوى.") {
    super(message, 422, "SAFETY_BLOCKED");
    this.name = "TutorSafetyBlockedError";
    Object.setPrototypeOf(this, TutorSafetyBlockedError.prototype);
  }
}

/**
 * Transient/unexpected AI failure: provider rate limit, network/5xx error, or
 * unparseable model output. Mapped to 503 so the client can retry.
 */
export class TutorUnavailableError extends TutorError {
  constructor(message = "تعذّر الحصول على إجابة من المساعد الذكي حالياً. حاول مرة أخرى.") {
    super(message, 503, "TUTOR_UNAVAILABLE");
    this.name = "TutorUnavailableError";
    Object.setPrototypeOf(this, TutorUnavailableError.prototype);
  }
}

/**
 * STORY-64: the authenticated student has no active enrollment in any chapter.
 * The Story's acceptance criteria explicitly mandate 401 for this case.
 */
export class TutorNotEnrolledError extends TutorError {
  constructor(message = "يجب الاشتراك في فصل دراسي واحد على الأقل لاستخدام المساعد الذكي.") {
    super(message, 401, "NOT_ENROLLED");
    this.name = "TutorNotEnrolledError";
    Object.setPrototypeOf(this, TutorNotEnrolledError.prototype);
  }
}

/** STORY-64: the student exceeded the daily AI-tutor query limit. */
export class TutorDailyLimitError extends TutorError {
  constructor(message = "لقد تجاوزت الحد اليومي المسموح به من أسئلة المساعد الذكي. حاول غداً.") {
    super(message, 429, "DAILY_LIMIT_EXCEEDED");
    this.name = "TutorDailyLimitError";
    Object.setPrototypeOf(this, TutorDailyLimitError.prototype);
  }
}
