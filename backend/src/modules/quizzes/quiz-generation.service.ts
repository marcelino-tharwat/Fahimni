import { prisma as defaultPrisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { geminiClient } from "../../shared/services/geminiClient.js";
import { aiService } from "../ai/ai.service.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import {
  GeminiContentBlockedError,
  GeminiRateLimitError,
  GeminiNetworkError,
} from "../../shared/errors/geminiErrors.js";
import { GeminiTimeoutError } from "../../shared/errors/geminiErrors.js";
import { buildQuizGenerationPrompt } from "../ai/gemini/prompts/quiz-generation.prompt.js";
import {
  parseQuizGenerationResponse,
  type ParsedQuestion,
} from "./quiz-generation.parser.js";
import {
  ContentNotIndexedError,
  GeminiSafetyBlockedError,
  QuizGenerationError,
  QuizGenerationPersistenceError,
  QuizGenerationTimeoutError,
} from "./quiz-generation.errors.js";
import { quizPublicFields, questionPublicFields } from "./quizzes.types.js";
import type { GenerateQuizInput, SourceScope } from "./dto/generate-quiz.dto.js";
import type { QuestionType, QuizStatus } from "../../generated/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { Prisma as PrismaNamespace } from "../../generated/prisma/client.js";
import {
  persistQuizLessonRelations,
  type QuizContentScope,
} from "./quiz-scope.js";
import { resolveQuizDifficulty, pickQuizLevelDifficulty } from "./quiz-difficulty.js";
import {
  buildAllocationPlan,
  type AllocationPlan,
  type AllocationBucket,
} from "./quiz-generation-allocation.service.js";

// Canonical STORY-45 budgets, env-configurable (defaults: total 25s, Gemini 20s;
// the Gemini call timeout must remain < the total endpoint deadline).
const DEFAULT_TOTAL_TIMEOUT_MS = env.QUIZ_GENERATION_TIMEOUT_MS;
const DEFAULT_GEMINI_TIMEOUT_MS = env.QUIZ_GENERATION_GEMINI_TIMEOUT_MS;
const DEFAULT_TOP_K = 8;
const DEFAULT_MAX_PROMPT_CHARS = 12_000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;

const DIFFICULTY_LABEL_AR: Record<"easy" | "medium" | "hard", string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

/** Teacher-only difficulty label surfaced in the generation response. */
export type QuestionDifficultyLabel = "EASY" | "MEDIUM" | "HARD";

export interface GeneratedQuestionDTO {
  id: string;
  quizId: string;
  type: QuestionType;
  content: string;
  options: unknown;
  correctAnswer: string | null;
  sortOrder: number;
  points: number;
  // ── Teacher-only metadata (additive) ───────────────────────────────────────
  // Returned only from the teacher generation endpoint. Not persisted (no
  // schema column) and never included in any student-facing question payload.
  difficulty: QuestionDifficultyLabel | null;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourceChapterTitle: string | null;
}

export interface GeneratedQuizDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  contentScope: QuizContentScope;
  // Server-derived source provenance (teacher-only draft response).
  sourceScope: SourceScope;
  sourceChapterIds: string[];
  sourceStageId: string | null;
  status: QuizStatus;
  questionCount: number;
  totalPoints: number;
  createdAt: Date;
  updatedAt: Date;
  questions: GeneratedQuestionDTO[];
}

/** Minimal Prisma surface used by this service, for testability. */
type PrismaLike = typeof defaultPrisma;
type RagLike = Pick<
  typeof aiService,
  "similaritySearchInLessons" | "countChunksInLessons"
>;
type GeminiLike = Pick<typeof geminiClient, "generateContent">;

export interface QuizGenerationServiceDeps {
  prisma?: PrismaLike;
  rag?: RagLike;
  gemini?: GeminiLike;
  totalTimeoutMs?: number;
  geminiTimeoutMs?: number;
  topK?: number;
  maxPromptChars?: number;
}

/**
 * A parsed question paired with its resolved teacher-only source metadata.
 * The metadata is response-only (never persisted) and never reaches students.
 */
interface QuestionWithSource {
  parsed: ParsedQuestion;
  difficulty: QuestionDifficultyLabel | null;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourceChapterTitle: string | null;
}

/**
 * Orchestrates STORY-45 AI quiz generation:
 *   resolve & authorize content → RAG retrieval → prompt build → Gemini call
 *   → parse/validate → single persistence transaction → return draft quiz.
 *
 * The whole operation runs under a 25s deadline; the Gemini call is capped at
 * 20s. Nothing is persisted after the deadline elapses.
 */
export class QuizGenerationService {
  private readonly prisma: PrismaLike;
  private readonly rag: RagLike;
  private readonly gemini: GeminiLike;
  private readonly totalTimeoutMs: number;
  private readonly geminiTimeoutMs: number;
  private readonly topK: number;
  private readonly maxPromptChars: number;

  constructor(deps: QuizGenerationServiceDeps = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.rag = deps.rag ?? aiService;
    this.gemini = deps.gemini ?? geminiClient;
    this.totalTimeoutMs = deps.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
    this.geminiTimeoutMs = deps.geminiTimeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
    this.topK = deps.topK ?? DEFAULT_TOP_K;
    this.maxPromptChars = deps.maxPromptChars ?? DEFAULT_MAX_PROMPT_CHARS;
  }

  public async generate(
    input: GenerateQuizInput,
    teacherId: string,
  ): Promise<GeneratedQuizDTO> {
    const deadline = Date.now() + this.totalTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new QuizGenerationTimeoutError()),
        this.totalTimeoutMs,
      );
    });

    const work = this._generate(input, teacherId, deadline);
    // If the total-deadline timer wins the race, `work` may still settle later;
    // attach a no-op catch so its eventual rejection is not "unhandled".
    work.catch(() => undefined);

    try {
      return await Promise.race([work, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private assertDeadline(deadline: number): void {
    if (Date.now() > deadline) {
      throw new QuizGenerationTimeoutError();
    }
  }

  private async _generate(
    input: GenerateQuizInput,
    teacherId: string,
    deadline: number,
  ): Promise<GeneratedQuizDTO> {
    const startedAt = Date.now();

    // 1. Resolve, authorize & allocate the requested content source.
    const plan = await buildAllocationPlan(input, teacherId, this.prisma);

    logger.info("quiz_generation_started", {
      teacherId,
      chapterId: plan.chapterId,
      sourceScope: plan.sourceScope,
      allocationMode: plan.allocationMode,
      contentScope: plan.contentScope,
      bucketCount: plan.buckets.length,
      resolvedLessonCount: plan.lessonIds.length,
      questionCount: input.questionCount,
      difficultyMode: input.difficultyMode,
    });

    const result =
      plan.allocationMode === "AUTO"
        ? await this.generateSinglePass(input, plan, teacherId, deadline)
        : await this.generateMultiPass(input, plan, teacherId, deadline);

    logger.info("quiz_generation_completed", {
      teacherId,
      quizId: result.id,
      chapterId: plan.chapterId,
      sourceScope: plan.sourceScope,
      allocationMode: plan.allocationMode,
      contentScope: plan.contentScope,
      questionCount: result.questions.length,
      totalMs: Date.now() - startedAt,
    });

    return result;
  }

  /**
   * AUTO allocation: a single grounded generation pass over all resolved
   * content. Preserves the original single-chapter behavior (one Gemini call,
   * exact-total + full-type-coverage validation, single-lesson attribution).
   */
  private async generateSinglePass(
    input: GenerateQuizInput,
    plan: AllocationPlan,
    teacherId: string,
    deadline: number,
  ): Promise<GeneratedQuizDTO> {
    const resolvedDifficulty = this.resolveDifficultyFor(input, input.questionCount);

    // RAG precondition: there must be usable indexed chunks.
    const chunkCount = await this.rag.countChunksInLessons(plan.lessonIds);
    if (chunkCount === 0) {
      throw new ContentNotIndexedError();
    }

    const preparedChunks = await this.retrieveChunks(
      input,
      plan.lessonIds,
      plan.sourceTitles,
      resolvedDifficulty,
    );

    const prompt = this.buildPrompt(
      input,
      preparedChunks,
      input.questionCount,
      plan.sourceTitles,
      resolvedDifficulty,
      input.types,
    );

    const raw = await this.callGemini(prompt);
    this.assertDeadline(deadline);

    const parsed = parseQuizGenerationResponse(raw, {
      questionCount: input.questionCount,
      requestedTypes: input.types,
    });

    const difficultyLabels = this.deriveDifficultyLabels(
      parsed.questions,
      resolvedDifficulty,
    );

    // Source lesson can only be attributed when exactly one lesson fed the pass.
    const singleLesson =
      plan.lessons.length === 1 ? plan.lessons[0]! : null;

    const items: QuestionWithSource[] = parsed.questions.map((q, index) => ({
      parsed: q,
      difficulty: difficultyLabels[index] ?? null,
      sourceLessonId: singleLesson?.id ?? null,
      sourceLessonTitle: singleLesson?.title ?? null,
      sourceChapterTitle: plan.chapterTitle,
    }));

    const title = this.resolveTitle(parsed.title, input, plan.sourceTitles);
    const description = parsed.description
      ? parsed.description.slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

    this.assertDeadline(deadline);
    return this.persistPlan(title, description, plan, teacherId, items, resolvedDifficulty);
  }

  /**
   * BY_CHAPTER / BY_LESSON allocation: one grounded generation pass per bucket,
   * run in parallel, then merged into a single draft quiz. Each pass produces
   * exactly its bucket's questionCount; the merged quiz's total therefore equals
   * the requested questionCount. Every question keeps real per-bucket source
   * attribution (chapter/lesson). All-or-nothing: any pass failing (empty
   * content, safety block, parse error) fails the whole request before persist.
   */
  private async generateMultiPass(
    input: GenerateQuizInput,
    plan: AllocationPlan,
    teacherId: string,
    deadline: number,
  ): Promise<GeneratedQuizDTO> {
    // Quiz-level difficulty (persisted on Quiz.difficulty), resolved once from
    // the teacher's overall request — independent of each bucket's own
    // per-pass resolution below, which only drives that bucket's prompt.
    const resolvedDifficulty = this.resolveDifficultyFor(input, input.questionCount);

    // Fail fast: every bucket must have usable indexed content before any
    // Gemini call, so we never persist a partial quiz.
    const chunkCounts = await Promise.all(
      plan.buckets.map((b) => this.rag.countChunksInLessons(b.lessonIds)),
    );
    plan.buckets.forEach((bucket, i) => {
      if ((chunkCounts[i] ?? 0) === 0) {
        const label = bucket.lessonTitle ?? bucket.chapterTitle ?? "المحدد";
        throw new ContentNotIndexedError(
          `لا يحتوي «${label}» على محتوى مفهرس كافٍ لتوليد الأسئلة.`,
        );
      }
    });

    // Run all bucket passes concurrently; the outer 25s deadline still bounds
    // the whole operation and each Gemini call is independently capped.
    const perBucket = await Promise.all(
      plan.buckets.map((bucket) =>
        this.runBucketPass(input, bucket, deadline),
      ),
    );

    this.assertDeadline(deadline);

    // Merge in bucket order, reassigning a stable 1-based sortOrder.
    const items: QuestionWithSource[] = [];
    perBucket.forEach(({ bucket, questions, difficultyLabels }) => {
      questions.forEach((q, index) => {
        const withOrder: ParsedQuestion = {
          ...q,
          sortOrder: items.length + 1,
        };
        items.push({
          parsed: withOrder,
          difficulty: difficultyLabels[index] ?? null,
          sourceLessonId: bucket.lessonId,
          sourceLessonTitle: bucket.lessonTitle,
          sourceChapterTitle: bucket.chapterTitle,
        });
      });
    });

    const geminiTitle = perBucket.find((p) => p.title)?.title ?? null;
    const title = this.resolveTitle(geminiTitle, input, plan.sourceTitles);
    const description = perBucket.find((p) => p.description)?.description
      ? perBucket.find((p) => p.description)!.description!.slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

    this.assertDeadline(deadline);
    return this.persistPlan(title, description, plan, teacherId, items, resolvedDifficulty);
  }

  /** Run a single bucket's grounded generation pass (scoped RAG → Gemini → parse). */
  private async runBucketPass(
    input: GenerateQuizInput,
    bucket: AllocationBucket,
    deadline: number,
  ): Promise<{
    bucket: AllocationBucket;
    questions: ParsedQuestion[];
    difficultyLabels: Array<QuestionDifficultyLabel | null>;
    title: string | null;
    description: string | null;
  }> {
    const resolvedDifficulty = this.resolveDifficultyFor(input, bucket.questionCount);
    const sourceTitles = [bucket.chapterTitle, bucket.lessonTitle].filter(
      (t): t is string => Boolean(t),
    );

    const preparedChunks = await this.retrieveChunks(
      input,
      bucket.lessonIds,
      sourceTitles,
      resolvedDifficulty,
    );

    const prompt = this.buildPrompt(
      input,
      preparedChunks,
      bucket.questionCount,
      sourceTitles,
      resolvedDifficulty,
      input.types,
    );

    const raw = await this.callGemini(prompt);
    this.assertDeadline(deadline);

    // Per-bucket buckets may be smaller than the number of requested types, so
    // full type coverage is enforced on the merged quiz, not per bucket.
    const parsed = parseQuizGenerationResponse(raw, {
      questionCount: bucket.questionCount,
      requestedTypes: input.types,
      requireEveryRequestedType: false,
    });

    return {
      bucket,
      questions: parsed.questions,
      difficultyLabels: this.deriveDifficultyLabels(
        parsed.questions,
        resolvedDifficulty,
      ),
      title: parsed.title,
      description: parsed.description,
    };
  }

  /** Resolve the difficulty plan for a given question count (SINGLE or MIXED). */
  private resolveDifficultyFor(
    input: GenerateQuizInput,
    questionCount: number,
  ): ReturnType<typeof resolveQuizDifficulty> {
    return resolveQuizDifficulty(
      input.difficultyMode === "SINGLE"
        ? {
            difficultyMode: "SINGLE",
            difficulty: input.difficulty,
            questionCount,
          }
        : {
            difficultyMode: "MIXED",
            difficultyDistribution: input.difficultyDistribution,
            questionCount,
          },
    );
  }

  /** Scoped semantic retrieval + chunk preparation for a lesson set. */
  private async retrieveChunks(
    input: GenerateQuizInput,
    lessonIds: string[],
    sourceTitles: string[],
    resolvedDifficulty: ReturnType<typeof resolveQuizDifficulty>,
  ): Promise<Array<{ index: number; content: string }>> {
    const ragQuery = this.buildRagQuery(input, sourceTitles, resolvedDifficulty);
    const rawChunks = await this.rag.similaritySearchInLessons(
      ragQuery,
      lessonIds,
      this.topK,
    );
    const preparedChunks = this.prepareChunks(rawChunks);
    if (preparedChunks.length === 0) {
      throw new ContentNotIndexedError(
        "لم يتم العثور على محتوى مفهرس قابل للاستخدام للمعايير المحددة.",
      );
    }
    return preparedChunks;
  }

  /** Build the controlled, grounded generation prompt for a pass. */
  private buildPrompt(
    input: GenerateQuizInput,
    chunks: Array<{ index: number; content: string }>,
    questionCount: number,
    sourceTitles: string[],
    resolvedDifficulty: ReturnType<typeof resolveQuizDifficulty>,
    types: GenerateQuizInput["types"],
  ): string {
    return buildQuizGenerationPrompt({
      chunks,
      questionCount,
      types,
      difficultyMode: resolvedDifficulty.difficultyMode,
      difficultyQuestionCounts: resolvedDifficulty.questionCounts,
      sourceTitles,
      ...(resolvedDifficulty.difficultyMode === "SINGLE"
        ? { difficulty: resolvedDifficulty.difficulty }
        : {}),
      ...(input.topicFocus !== undefined ? { topicFocus: input.topicFocus } : {}),
    });
  }

  /**
   * Per-question difficulty labels (uppercased, teacher-only). Prefers the
   * model's own label, falling back to the resolved distribution in enum order.
   */
  private deriveDifficultyLabels(
    questions: ParsedQuestion[],
    resolvedDifficulty: ReturnType<typeof resolveQuizDifficulty>,
  ): Array<QuestionDifficultyLabel | null> {
    const fallback = this.buildDifficultyFallback(
      resolvedDifficulty,
      questions.length,
    );
    return questions.map((q, index) => {
      const label = (q.difficulty ?? fallback[index] ?? "medium") as
        | "easy"
        | "medium"
        | "hard";
      return label.toUpperCase() as QuestionDifficultyLabel;
    });
  }

  /** Build the semantic search query, prioritizing topicFocus when present. */
  private buildRagQuery(
    input: GenerateQuizInput,
    sourceTitles: string[],
    resolvedDifficulty: ReturnType<typeof resolveQuizDifficulty>,
  ): string {
    const parts: string[] = [];
    if (input.topicFocus) {
      parts.push(input.topicFocus);
    }
    parts.push(...sourceTitles);
    parts.push("أسئلة اختبار");
    if (resolvedDifficulty.difficultyMode === "SINGLE") {
      parts.push(DIFFICULTY_LABEL_AR[resolvedDifficulty.difficulty]);
    } else {
      parts.push("مستويات صعوبة متعددة");
    }
    return parts.join(" ").trim();
  }

  /**
   * Clean, de-duplicate and size-bound the retrieved chunks before they enter
   * the prompt. Highest-ranked chunks (already similarity-ordered) are kept
   * until the character budget is exhausted. No IDs/embeddings/metadata leak.
   */
  private prepareChunks(
    chunks: Array<{ content: string }>,
  ): Array<{ index: number; content: string }> {
    const seen = new Set<string>();
    const prepared: Array<{ index: number; content: string }> = [];
    let budget = this.maxPromptChars;

    for (const chunk of chunks) {
      const content = (chunk.content ?? "").trim();
      if (!content) {
        continue;
      }
      const key = content.replace(/\s+/g, " ");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (budget <= 0) {
        break;
      }

      const slice =
        content.length > budget
          ? this.safeTruncate(content, budget)
          : content;
      budget -= slice.length;

      prepared.push({ index: prepared.length + 1, content: slice });
    }

    return prepared;
  }

  /** Truncate without cutting in the middle of a word/Arabic token. */
  private safeTruncate(text: string, max: number): string {
    if (text.length <= max) {
      return text;
    }
    const slice = text.slice(0, max);
    const lastSpace = slice.lastIndexOf(" ");
    return lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  }

  private async callGemini(prompt: string): Promise<string> {
    try {
      return await this.gemini.generateContent(
        prompt,
        {
          temperature: 0.3,
          responseMimeType: "application/json",
          maxOutputTokens: 8_192,
        },
        { timeoutMs: this.geminiTimeoutMs },
      );
    } catch (error) {
      if (error instanceof GeminiContentBlockedError) {
        throw new GeminiSafetyBlockedError();
      }
      if (error instanceof GeminiTimeoutError) {
        throw new QuizGenerationTimeoutError(
          "انتهت مهلة استدعاء خدمة الذكاء الاصطناعي.",
        );
      }
      if (
        error instanceof GeminiRateLimitError ||
        error instanceof GeminiNetworkError
      ) {
        throw new QuizGenerationError(
          "تعذّر إنشاء الأسئلة بسبب خطأ مؤقت في خدمة الذكاء الاصطناعي.",
          { reason: "GEMINI_ERROR" },
        );
      }
      // Auth / unknown errors are unexpected → bubble up (handled as 500).
      throw error;
    }
  }

  private resolveTitle(
    geminiTitle: string | null,
    input: GenerateQuizInput,
    sourceTitles: string[],
  ): string {
    const candidate =
      geminiTitle?.trim() ||
      input.topicFocus?.trim() ||
      sourceTitles[0] ||
      "اختبار مُولّد بالذكاء الاصطناعي";

    const base = candidate.startsWith("اختبار")
      ? candidate
      : `اختبار: ${candidate}`;

    return base.slice(0, MAX_TITLE_LENGTH);
  }

  /**
   * Single all-or-nothing transaction: create the draft quiz + its questions.
   * `items` carry each question's resolved teacher-only source metadata; the
   * metadata is echoed in the response only and never written to the database.
   */
  private async persistPlan(
    title: string,
    description: string | null,
    plan: AllocationPlan,
    teacherId: string,
    items: QuestionWithSource[],
    resolvedDifficulty: ReturnType<typeof resolveQuizDifficulty>,
  ): Promise<GeneratedQuizDTO> {
    const questions = items.map((i) => i.parsed);
    const difficulty = pickQuizLevelDifficulty(resolvedDifficulty).toUpperCase() as
      | "EASY"
      | "MEDIUM"
      | "HARD";
    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const quiz = await tx.quiz.create({
          data: {
            title,
            description,
            chapterId: plan.chapterId,
            contentScope: plan.contentScope,
            // Source provenance is server-derived from the validated, ownership-
            // checked allocation plan — never read from the raw client body.
            sourceScope: plan.sourceScope,
            sourceChapterIds: plan.sourceChapterIds,
            sourceStageId: plan.sourceStageId,
            createdBy: teacherId,
            difficulty,
          },
          select: quizPublicFields,
        });

        await persistQuizLessonRelations(
          tx,
          quiz.id,
          plan.contentScope,
          plan.contentScope === "SELECTED_LESSONS" ? plan.lessonIds : [],
        );

        await tx.question.createMany({
          data: questions.map((q) => ({
            quizId: quiz.id,
            type: q.type,
            text: q.content,
            options: (q.options ?? []) as Prisma.InputJsonValue,
            correctAnswer: q.correctAnswer,
            sortOrder: q.sortOrder,
            // Persist the (possibly type-defaulted / model-supplied) points so the
            // draft carries real per-question weights, not the schema default.
            points: q.points,
          })),
        });

        const persistedQuestions = await tx.question.findMany({
          where: { quizId: quiz.id },
          orderBy: { sortOrder: "asc" },
          select: questionPublicFields,
        });

        return { quiz, persistedQuestions };
      });
    } catch (error) {
      if (error instanceof QuizGenerationError) {
        throw error;
      }
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
        logger.error("quiz_generation_persist_failed", {
          teacherId,
          chapterId: plan.chapterId,
          contentScope: plan.contentScope,
          prismaCode: error.code,
        });
        throw new QuizGenerationPersistenceError(
          error.code === "P2003"
            ? "المحتوى المرتبط (الفصل أو الدرس) لم يعد متاحاً. يرجى التحقق من المحتوى ثم إعادة المحاولة."
            : undefined,
        );
      }
      logger.error("quiz_generation_persist_failed", {
        teacherId,
        chapterId: plan.chapterId,
        contentScope: plan.contentScope,
      });
      throw new QuizGenerationPersistenceError();
    }

    await auditLogService.record({
      action: "QUIZ_GENERATED",
      resourceType: "QUIZ",
      resourceId: created.quiz.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: {
        title,
        chapterId: plan.chapterId,
        contentScope: plan.contentScope,
        sourceScope: plan.sourceScope,
        allocationMode: plan.allocationMode,
        questionCount: questions.length,
      },
    });

    // Index the resolved teacher-only metadata by sortOrder for the response.
    const metaBySortOrder = new Map(
      items.map((i) => [i.parsed.sortOrder, i]),
    );
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const quizRow = created.quiz as unknown as Record<string, unknown>;

    return {
      id: quizRow.id as string,
      title: quizRow.title as string,
      description: (quizRow.description as string | null) ?? null,
      chapterId: (quizRow.chapterId as string | null) ?? null,
      contentScope: (quizRow.contentScope as QuizContentScope) ?? "CHAPTER",
      sourceScope: plan.sourceScope,
      sourceChapterIds: plan.sourceChapterIds,
      sourceStageId: plan.sourceStageId,
      status: quizRow.status as QuizStatus,
      questionCount: created.persistedQuestions.length,
      totalPoints,
      createdAt: quizRow.createdAt as Date,
      updatedAt: quizRow.updatedAt as Date,
      questions: created.persistedQuestions.map((q) => {
        const row = q as unknown as Record<string, unknown>;
        const sortOrder = row.sortOrder as number;
        const meta = metaBySortOrder.get(sortOrder);
        return {
          id: row.id as string,
          quizId: row.quizId as string,
          type: row.type as QuestionType,
          content: row.text as string,
          options: row.options,
          correctAnswer: (row.correctAnswer as string | null) ?? null,
          sortOrder,
          points: meta?.parsed.points ?? 1,
          difficulty: meta?.difficulty ?? null,
          sourceLessonId: meta?.sourceLessonId ?? null,
          sourceLessonTitle: meta?.sourceLessonTitle ?? null,
          sourceChapterTitle: meta?.sourceChapterTitle ?? null,
        };
      }),
    };
  }

  /**
   * Deterministic per-question difficulty labels (lowercase) used when the model
   * did not tag a question. SINGLE → every question shares the requested level.
   * MIXED → expand the resolved integer counts in enum order (easy→medium→hard).
   */
  private buildDifficultyFallback(
    resolved: ReturnType<typeof resolveQuizDifficulty>,
    total: number,
  ): Array<"easy" | "medium" | "hard"> {
    if (resolved.difficultyMode === "SINGLE") {
      return Array.from({ length: total }, () => resolved.difficulty);
    }
    const out: Array<"easy" | "medium" | "hard"> = [];
    (["easy", "medium", "hard"] as const).forEach((level) => {
      for (let i = 0; i < resolved.questionCounts[level]; i += 1) {
        out.push(level);
      }
    });
    return out;
  }
}
