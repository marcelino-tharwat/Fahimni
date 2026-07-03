import { AppError } from "../../shared/utils/AppError.js";

/**
 * Safe retry hint surfaced to clients for every quiz-generation failure.
 */
export const RETRY_SUGGESTION =
  "حاول مرة أخرى بعدد أسئلة أقل أو بأنواع أسئلة أبسط.";

export interface QuizGenerationErrorOptions {
  /** Safe, non-sensitive reason category (no raw model output / chunks). */
  reason?: string;
  /** Safe human-readable detail. Never include prompts, chunks, or payloads. */
  details?: string;
  suggestion?: string;
  statusCode?: number;
}

/**
 * Base class for expected AI quiz-generation failures. These all map to HTTP
 * 422 via the global error handler and carry safe `details`/`suggestion`
 * fields. They deliberately extend {@link AppError} so the existing error
 * pipeline (status mapping, isOperational) keeps working unchanged.
 */
export class QuizGenerationError extends AppError {
  public readonly reason: string;
  public readonly details: string | undefined;
  public readonly suggestion: string;

  constructor(message: string, options: QuizGenerationErrorOptions = {}) {
    super(message, options.statusCode ?? 422);
    this.name = "QuizGenerationError";
    this.reason = options.reason ?? "GENERATION_FAILED";
    this.details = options.details;
    this.suggestion = options.suggestion ?? RETRY_SUGGESTION;
    Object.setPrototypeOf(this, QuizGenerationError.prototype);
  }
}

/** The selected content has no usable indexed chunks for RAG retrieval. */
export class ContentNotIndexedError extends QuizGenerationError {
  constructor(details?: string) {
    super("المحتوى المحدد غير جاهز لإنشاء الأسئلة بالذكاء الاصطناعي.", {
      reason: "CONTENT_NOT_INDEXED",
      details:
        details ??
        "لا يوجد محتوى مُفهرس قابل للاستخدام للمحتوى المحدد. يرجى فهرسة الدروس أولاً ثم إعادة المحاولة.",
      suggestion: "قم بفهرسة محتوى الدروس أو أعد الفهرسة ثم حاول مرة أخرى.",
    });
    this.name = "ContentNotIndexedError";
    Object.setPrototypeOf(this, ContentNotIndexedError.prototype);
  }
}

/** Gemini output could not be parsed/validated into a valid quiz. */
export class QuizGenerationParseError extends QuizGenerationError {
  constructor(details?: string) {
    super("تعذر إنشاء اختبار صالح من المحتوى المحدد.", {
      reason: "INVALID_AI_OUTPUT",
      details:
        details ?? "لم يتمكن النظام من التحقق من بنية الأسئلة الناتجة.",
    });
    this.name = "QuizGenerationParseError";
    Object.setPrototypeOf(this, QuizGenerationParseError.prototype);
  }
}

/** The total generation budget (25s) or the Gemini call (20s) timed out. */
export class QuizGenerationTimeoutError extends QuizGenerationError {
  constructor(details?: string) {
    super("انتهت مهلة إنشاء الاختبار قبل اكتماله.", {
      reason: "GENERATION_TIMEOUT",
      details:
        details ??
        "استغرقت عملية الإنشاء وقتاً أطول من المسموح. حاول بعدد أسئلة أقل.",
    });
    this.name = "QuizGenerationTimeoutError";
    Object.setPrototypeOf(this, QuizGenerationTimeoutError.prototype);
  }
}

/** Gemini blocked the request/response via its safety filters. */
export class GeminiSafetyBlockedError extends QuizGenerationError {
  constructor() {
    super("تعذر إنشاء الأسئلة بسبب قيود أمان المحتوى.", {
      reason: "SAFETY_BLOCKED",
      details: "حظر مزود الذكاء الاصطناعي المحتوى لأسباب تتعلق بالسلامة.",
    });
    this.name = "GeminiSafetyBlockedError";
    Object.setPrototypeOf(this, GeminiSafetyBlockedError.prototype);
  }
}

/** Database persistence failed during quiz generation. */
export class QuizGenerationPersistenceError extends QuizGenerationError {
  constructor(details?: string) {
    super("تعذر حفظ الاختبار المُولَّد.", {
      reason: "PERSISTENCE_FAILED",
      statusCode: 503,
      details:
        details ??
        "حدث خطأ أثناء حفظ الاختبار. لم يتم إنشاء اختبار غير مكتمل.",
      suggestion: "حاول مرة أخرى. إذا استمرت المشكلة تواصل مع الدعم.",
    });
    this.name = "QuizGenerationPersistenceError";
    Object.setPrototypeOf(this, QuizGenerationPersistenceError.prototype);
  }
}
