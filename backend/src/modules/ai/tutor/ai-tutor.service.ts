import { prisma as defaultPrisma } from "../../../config/database.js";
import { logger } from "../../../config/logger.js";
import { geminiClient } from "../../../shared/services/geminiClient.js";
import { aiService } from "../ai.service.js";
import {
  GeminiContentBlockedError,
  GeminiRateLimitError,
  GeminiNetworkError,
  GeminiTimeoutError,
} from "../../../shared/errors/geminiErrors.js";
import {
  buildTutorPrompt,
  buildTutorSystemInstruction,
  detectQuestionLanguage,
  TUTOR_NOT_FOUND_MESSAGE,
  type TutorPromptSource,
} from "../gemini/prompts/tutor-prompt.js";
import { parseTutorResponse } from "./ai-tutor.parser.js";
import {
  TutorTimeoutError,
  TutorSafetyBlockedError,
  TutorUnavailableError,
  TutorValidationError,
} from "./ai-tutor.errors.js";

const DEFAULT_TOTAL_TIMEOUT_MS = 25_000;
const DEFAULT_RETRIEVAL_TIMEOUT_MS = 15_000;
const DEFAULT_GEMINI_TIMEOUT_MS = 10_000;
const DEFAULT_TOP_K = 5;
const DEFAULT_MAX_QUESTION_LENGTH = 1_000;
const DEFAULT_MAX_ANSWER_CHARS = 4_000;

/** A single lesson citation in the public tutor result. */
export interface TutorCitation {
  lessonId: string;
  lessonTitle: string;
  chapterName: string;
  relevanceScore: number;
}

/** The public result of {@link AiTutorService.ask}. */
export interface TutorAnswer {
  answer: string;
  citations: TutorCitation[];
}

/**
 * Optional per-call budget overrides. When omitted, the instance defaults
 * (total 25s / retrieval 15s / generation 10s) apply, so existing callers are
 * unaffected. STORY-64's endpoint passes a tighter sub-20s budget here.
 */
export interface TutorAskOptions {
  totalTimeoutMs?: number;
  retrievalTimeoutMs?: number;
  geminiTimeoutMs?: number;
}

/** A retrieved chunk enriched with trusted metadata, scoped to one ask call. */
interface PreparedSource extends TutorPromptSource {
  lessonId: string;
  relevanceScore: number;
}

type PrismaLike = typeof defaultPrisma;
type RagLike = Pick<typeof aiService, "similaritySearchInLessons">;
type GeminiLike = Pick<typeof geminiClient, "generateContent">;

export interface AiTutorServiceDeps {
  prisma?: PrismaLike;
  rag?: RagLike;
  gemini?: GeminiLike;
  totalTimeoutMs?: number;
  retrievalTimeoutMs?: number;
  geminiTimeoutMs?: number;
  topK?: number;
  maxQuestionLength?: number;
  maxAnswerChars?: number;
}

/**
 * STORY-63 — AI Tutor service: RAG-grounded Q&A with Gemini.
 *
 * Flow: validate → resolve the student's accessible lessons (enrollment-scoped)
 * → reuse the shared RAG similarity search (embeds the question + top-K vector
 * query) → if no chunks return the localized not-found WITHOUT calling Gemini →
 * otherwise build a grounded, injection-resistant prompt → call Gemini (10s) →
 * strictly parse {answer, citationRefs} → map citation keys back to TRUSTED
 * database metadata.
 *
 * Budgets: retrieval ≤ 15s, generation ≤ 10s, total ≤ 25s. Each call is fully
 * independent — there is no conversation memory or module-level state.
 */
export class AiTutorService {
  private readonly prisma: PrismaLike;
  private readonly rag: RagLike;
  private readonly gemini: GeminiLike;
  private readonly totalTimeoutMs: number;
  private readonly retrievalTimeoutMs: number;
  private readonly geminiTimeoutMs: number;
  private readonly topK: number;
  private readonly maxQuestionLength: number;
  private readonly maxAnswerChars: number;

  constructor(deps: AiTutorServiceDeps = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.rag = deps.rag ?? aiService;
    this.gemini = deps.gemini ?? geminiClient;
    this.totalTimeoutMs = deps.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
    this.retrievalTimeoutMs =
      deps.retrievalTimeoutMs ?? DEFAULT_RETRIEVAL_TIMEOUT_MS;
    this.geminiTimeoutMs = deps.geminiTimeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
    this.topK = deps.topK ?? DEFAULT_TOP_K;
    this.maxQuestionLength =
      deps.maxQuestionLength ?? DEFAULT_MAX_QUESTION_LENGTH;
    this.maxAnswerChars = deps.maxAnswerChars ?? DEFAULT_MAX_ANSWER_CHARS;
  }

  public async ask(
    question: string,
    studentId: string,
    options: TutorAskOptions = {},
  ): Promise<TutorAnswer> {
    const trimmed = this.validateQuestion(question);
    this.validateStudentId(studentId);
    const language = detectQuestionLanguage(trimmed);

    const totalTimeoutMs = options.totalTimeoutMs ?? this.totalTimeoutMs;
    const retrievalTimeoutMs =
      options.retrievalTimeoutMs ?? this.retrievalTimeoutMs;
    const geminiTimeoutMs = options.geminiTimeoutMs ?? this.geminiTimeoutMs;

    const deadline = Date.now() + totalTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TutorTimeoutError()), totalTimeoutMs);
    });

    const work = this._ask(
      trimmed,
      studentId,
      language,
      deadline,
      retrievalTimeoutMs,
      geminiTimeoutMs,
    );
    // If the deadline wins the race, `work` may still settle later; swallow its
    // eventual rejection so it is never an unhandled promise.
    work.catch(() => undefined);

    try {
      return await Promise.race([work, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async _ask(
    question: string,
    studentId: string,
    language: "ar" | "en",
    deadline: number,
    retrievalTimeoutMs: number,
    geminiTimeoutMs: number,
  ): Promise<TutorAnswer> {
    const startedAt = Date.now();

    // 1–3. Retrieval (embed + access-scoped top-K search) under its budget.
    const sources = await this.retrieve(question, studentId, retrievalTimeoutMs);

    // 7 (Phase): no accessible relevant chunks → localized not-found, no Gemini.
    if (sources.length === 0) {
      logger.info(
        `[AiTutor] not-found (no chunks) lang=${language} qlen=${question.length} totalMs=${Date.now() - startedAt}`,
      );
      return { answer: TUTOR_NOT_FOUND_MESSAGE[language], citations: [] };
    }

    this.assertDeadline(deadline);

    // 4–6. Grounded prompt → Gemini (10s) → strict parse.
    const prompt = buildTutorPrompt({ question, sources });
    const systemInstruction = buildTutorSystemInstruction(language);

    const geminiStart = Date.now();
    const raw = await this.callGemini(prompt, systemInstruction, geminiTimeoutMs);
    const geminiMs = Date.now() - geminiStart;

    this.assertDeadline(deadline);

    const parsed = parseTutorResponse(raw, {
      maxAnswerChars: this.maxAnswerChars,
    });

    // 7. Map model citation keys back to TRUSTED metadata (dedupe by lesson).
    const citations = this.mapCitations(parsed.citationRefs, sources);

    logger.info(
      `[AiTutor] success lang=${language} qlen=${question.length} ` +
        `sources=${sources.length} citations=${citations.length} ` +
        `geminiMs=${geminiMs} totalMs=${Date.now() - startedAt}`,
    );

    return { answer: parsed.answer, citations };
  }

  /** Retrieval stage wrapped in its own budget. */
  private async retrieve(
    question: string,
    studentId: string,
    retrievalTimeoutMs: number,
  ): Promise<PreparedSource[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new TutorTimeoutError("انتهت مهلة البحث في المحتوى.")),
        retrievalTimeoutMs,
      );
    });

    const work = this._retrieve(question, studentId);
    work.catch(() => undefined);

    try {
      return await Promise.race([work, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async _retrieve(
    question: string,
    studentId: string,
  ): Promise<PreparedSource[]> {
    // Accessible lessons: indexed/valid lessons inside chapters the student is
    // actively enrolled in. One bounded query, no N+1 — also yields the trusted
    // lesson title + chapter name used for citations.
    const lessons = await this.prisma.lesson.findMany({
      where: {
        deletedAt: null,
        chapter: {
          deletedAt: null,
          stage: { deletedAt: null },
          enrollments: { some: { studentId, status: "ACTIVE" } },
        },
      },
      select: { id: true, title: true, chapter: { select: { name: true } } },
    });

    if (lessons.length === 0) {
      return [];
    }

    const lessonMeta = new Map(
      lessons.map((l) => [
        l.id,
        { title: l.title, chapterName: l.chapter.name },
      ]),
    );
    const lessonIds = lessons.map((l) => l.id);

    let chunks;
    try {
      // Reuses the shared RAG search (STORY-43): embeds the question once and
      // runs the access-scoped cosine top-K pgvector query. K = 5.
      chunks = await this.rag.similaritySearchInLessons(
        question,
        lessonIds,
        this.topK,
      );
    } catch (error) {
      throw this.mapRetrievalError(error);
    }

    // Chunks arrive ordered by relevance (cosine similarity desc). Attach
    // controlled source keys + TRUSTED metadata; drop anything that somehow
    // falls outside the access scope.
    const sources: PreparedSource[] = [];
    for (const chunk of chunks) {
      const meta = lessonMeta.get(chunk.lessonId);
      if (!meta) {
        continue;
      }
      sources.push({
        key: `SOURCE_${sources.length + 1}`,
        lessonId: chunk.lessonId,
        lessonTitle: meta.title,
        chapterName: meta.chapterName,
        content: chunk.content,
        relevanceScore: this.normalizeScore(chunk.score),
      });
    }

    return sources;
  }

  private async callGemini(
    prompt: string,
    systemInstruction: string,
    geminiTimeoutMs: number,
  ): Promise<string> {
    try {
      return await this.gemini.generateContent(
        prompt,
        {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 2_048,
        },
        { timeoutMs: geminiTimeoutMs, systemInstruction },
      );
    } catch (error) {
      if (error instanceof GeminiContentBlockedError) {
        throw new TutorSafetyBlockedError();
      }
      if (error instanceof GeminiTimeoutError) {
        throw new TutorTimeoutError("انتهت مهلة استدعاء المساعد الذكي.");
      }
      if (
        error instanceof GeminiRateLimitError ||
        error instanceof GeminiNetworkError
      ) {
        throw new TutorUnavailableError();
      }
      // Auth / unknown errors are unexpected → bubble up (handled as 500).
      throw error;
    }
  }

  /** Map a retrieval-stage provider failure to a safe tutor error. */
  private mapRetrievalError(error: unknown): Error {
    if (error instanceof GeminiTimeoutError) {
      return new TutorTimeoutError("انتهت مهلة تجهيز سؤالك.");
    }
    if (
      error instanceof GeminiRateLimitError ||
      error instanceof GeminiNetworkError
    ) {
      return new TutorUnavailableError();
    }
    if (error instanceof Error) {
      return error;
    }
    return new TutorUnavailableError();
  }

  /**
   * Build citations from the model's source keys only. Unknown keys are ignored,
   * citations are de-duplicated by lesson (keeping the highest relevance score),
   * and order follows the first reference to each lesson.
   */
  private mapCitations(
    refs: string[],
    sources: PreparedSource[],
  ): TutorCitation[] {
    const byKey = new Map(sources.map((s) => [s.key, s]));
    const byLesson = new Map<string, TutorCitation>();
    const order: string[] = [];

    for (const ref of refs) {
      const src = byKey.get(ref);
      if (!src) {
        continue;
      }
      const existing = byLesson.get(src.lessonId);
      if (!existing) {
        byLesson.set(src.lessonId, {
          lessonId: src.lessonId,
          lessonTitle: src.lessonTitle,
          chapterName: src.chapterName,
          relevanceScore: src.relevanceScore,
        });
        order.push(src.lessonId);
      } else if (src.relevanceScore > existing.relevanceScore) {
        existing.relevanceScore = src.relevanceScore;
      }
    }

    return order.map((lessonId) => byLesson.get(lessonId)!);
  }

  /** Cosine similarity (1 − distance); clamped to [0,1] so higher = more relevant. */
  private normalizeScore(score: number): number {
    if (!Number.isFinite(score)) {
      return 0;
    }
    const clamped = Math.max(0, Math.min(1, score));
    return Math.round(clamped * 10_000) / 10_000;
  }

  private validateQuestion(question: string): string {
    if (typeof question !== "string") {
      throw new TutorValidationError("السؤال مطلوب.");
    }
    const trimmed = question.trim();
    if (trimmed.length === 0) {
      throw new TutorValidationError("لا يمكن أن يكون السؤال فارغاً.");
    }
    if (trimmed.length > this.maxQuestionLength) {
      throw new TutorValidationError(
        `السؤال طويل جداً (الحد الأقصى ${this.maxQuestionLength} حرف).`,
      );
    }
    return trimmed;
  }

  private validateStudentId(studentId: string): void {
    if (typeof studentId !== "string" || studentId.trim().length === 0) {
      throw new TutorValidationError("معرّف الطالب غير صالح.");
    }
  }

  private assertDeadline(deadline: number): void {
    if (Date.now() > deadline) {
      throw new TutorTimeoutError();
    }
  }
}

export const aiTutorService = new AiTutorService();
