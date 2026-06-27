import { prisma as defaultPrisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { geminiClient } from "../../shared/services/geminiClient.js";
import { aiService } from "../ai/ai.service.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { AppError } from "../../shared/utils/AppError.js";
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
  QuizGenerationTimeoutError,
} from "./quiz-generation.errors.js";
import { quizPublicFields, questionPublicFields } from "./quizzes.types.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";
import type { QuestionType, QuizStatus } from "../../generated/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";

const DEFAULT_TOTAL_TIMEOUT_MS = 60_000;
const DEFAULT_GEMINI_TIMEOUT_MS = 55_000;
const DEFAULT_TOP_K = 8;
const DEFAULT_MAX_PROMPT_CHARS = 12_000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;

const DIFFICULTY_LABEL_AR: Record<GenerateQuizInput["difficulty"], string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export interface GeneratedQuestionDTO {
  id: string;
  quizId: string;
  type: QuestionType;
  content: string;
  options: unknown;
  correctAnswer: string | null;
  sortOrder: number;
  points: number;
}

export interface GeneratedQuizDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
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

interface ResolvedContent {
  lessonIds: string[];
  sourceTitles: string[];
  chapterId: string | null;
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

    // 1. Resolve & authorize the requested content source.
    const content = await this.resolveContent(input, teacherId);

    // 2. RAG precondition: there must be usable indexed chunks.
    const chunkCount = await this.rag.countChunksInLessons(content.lessonIds);
    if (chunkCount === 0) {
      throw new ContentNotIndexedError();
    }

    // 3. Build a scoped semantic query and retrieve top-K chunks.
    const ragQuery = this.buildRagQuery(input, content.sourceTitles);
    const ragStart = Date.now();
    const rawChunks = await this.rag.similaritySearchInLessons(
      ragQuery,
      content.lessonIds,
      this.topK,
    );
    const ragMs = Date.now() - ragStart;

    const preparedChunks = this.prepareChunks(rawChunks);
    if (preparedChunks.length === 0) {
      throw new ContentNotIndexedError(
        "لم يتم العثور على محتوى مفهرس قابل للاستخدام للمعايير المحددة.",
      );
    }

    // 4. Build the controlled, grounded prompt.
    const prompt = buildQuizGenerationPrompt({
      chunks: preparedChunks,
      questionCount: input.questionCount,
      types: input.types,
      difficulty: input.difficulty,
      topicFocus: input.topicFocus,
      sourceTitles: content.sourceTitles,
    });

    // 5. Call Gemini (capped at 20s) and map provider failures to safe 422s.
    const geminiStart = Date.now();
    const raw = await this.callGemini(prompt);
    const geminiMs = Date.now() - geminiStart;

    this.assertDeadline(deadline);

    // 6. Parse & validate strictly — no partial persistence on failure.
    const parseStart = Date.now();
    const parsed = parseQuizGenerationResponse(raw, {
      questionCount: input.questionCount,
      requestedTypes: input.types,
    });
    const parseMs = Date.now() - parseStart;

    const title = this.resolveTitle(parsed.title, input, content);
    const description = parsed.description
      ? parsed.description.slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

    // 7. Final deadline guard so a late result never reaches the database.
    this.assertDeadline(deadline);

    const persistStart = Date.now();
    const result = await this.persist(
      title,
      description,
      content.chapterId,
      teacherId,
      parsed.questions,
    );
    const persistMs = Date.now() - persistStart;

    logger.info(
      `[QuizGeneration] success source=${
        input.chapterId ? "chapter" : "lessons"
      } lessons=${content.lessonIds.length} chunks=${preparedChunks.length} ` +
        `questions=${parsed.questions.length} types=${input.types.join("|")} ` +
        `ragMs=${ragMs} geminiMs=${geminiMs} parseMs=${parseMs} persistMs=${persistMs} ` +
        `totalMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  /** Resolve the content source, enforcing teacher ownership and soft-deletes. */
  private async resolveContent(
    input: GenerateQuizInput,
    teacherId: string,
  ): Promise<ResolvedContent> {
    if (input.chapterId) {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          id: input.chapterId,
          deletedAt: null,
          stage: { teacherId, deletedAt: null },
        },
        select: { id: true, name: true },
      });

      if (!chapter) {
        throw new AppError("Chapter not found", 404);
      }

      const lessons = await this.prisma.lesson.findMany({
        where: { chapterId: chapter.id, deletedAt: null },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      });

      if (lessons.length === 0) {
        throw new ContentNotIndexedError(
          "لا يحتوي الفصل المحدد على دروس قابلة للاستخدام.",
        );
      }

      return {
        lessonIds: lessons.map((l) => l.id),
        sourceTitles: [chapter.name, ...lessons.map((l) => l.title)],
        chapterId: chapter.id,
      };
    }

    // lessonIds path — all must exist, be owned, and be active.
    const lessonIds = input.lessonIds!;
    const lessons = await this.prisma.lesson.findMany({
      where: {
        id: { in: lessonIds },
        deletedAt: null,
        chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
      },
      select: { id: true, title: true, chapterId: true },
    });

    if (lessons.length !== lessonIds.length) {
      // Any missing/unauthorized/deleted lesson fails the whole request.
      throw new AppError("One or more lessons not found", 404);
    }

    const uniqueChapterIds = new Set(lessons.map((l) => l.chapterId));

    return {
      lessonIds: lessons.map((l) => l.id),
      sourceTitles: lessons.map((l) => l.title),
      // Single shared chapter → attach it; spanning multiple chapters → null.
      chapterId: uniqueChapterIds.size === 1 ? [...uniqueChapterIds][0]! : null,
    };
  }

  /** Build the semantic search query, prioritizing topicFocus when present. */
  private buildRagQuery(
    input: GenerateQuizInput,
    sourceTitles: string[],
  ): string {
    const parts: string[] = [];
    if (input.topicFocus) {
      parts.push(input.topicFocus);
    }
    parts.push(...sourceTitles);
    parts.push("أسئلة اختبار", DIFFICULTY_LABEL_AR[input.difficulty]);
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
    content: ResolvedContent,
  ): string {
    const candidate =
      geminiTitle?.trim() ||
      input.topicFocus?.trim() ||
      content.sourceTitles[0] ||
      "اختبار مُولّد بالذكاء الاصطناعي";

    const base = candidate.startsWith("اختبار")
      ? candidate
      : `اختبار: ${candidate}`;

    return base.slice(0, MAX_TITLE_LENGTH);
  }

  /** Single all-or-nothing transaction: create the draft quiz + its questions. */
  private async persist(
    title: string,
    description: string | null,
    chapterId: string | null,
    teacherId: string,
    questions: ParsedQuestion[],
  ): Promise<GeneratedQuizDTO> {
    const created = await this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          title,
          description,
          chapterId,
          createdBy: teacherId,
          // status defaults to DRAFT in the schema — never auto-published.
        },
        select: quizPublicFields,
      });

      await tx.question.createMany({
        data: questions.map((q) => ({
          quizId: quiz.id,
          type: q.type,
          text: q.content,
          options: (q.options ?? []) as Prisma.InputJsonValue,
          correctAnswer: q.correctAnswer,
          sortOrder: q.sortOrder,
        })),
      });

      const persistedQuestions = await tx.question.findMany({
        where: { quizId: quiz.id },
        orderBy: { sortOrder: "asc" },
        select: questionPublicFields,
      });

      return { quiz, persistedQuestions };
    });

    await auditLogService.record({
      action: "QUIZ_GENERATED",
      resourceType: "QUIZ",
      resourceId: created.quiz.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: {
        title,
        chapterId,
        questionCount: questions.length,
      },
    });

    const pointsBySortOrder = new Map(
      questions.map((q) => [q.sortOrder, q.points]),
    );
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const quizRow = created.quiz as unknown as Record<string, unknown>;

    return {
      id: quizRow.id as string,
      title: quizRow.title as string,
      description: (quizRow.description as string | null) ?? null,
      chapterId: (quizRow.chapterId as string | null) ?? null,
      status: quizRow.status as QuizStatus,
      questionCount: created.persistedQuestions.length,
      totalPoints,
      createdAt: quizRow.createdAt as Date,
      updatedAt: quizRow.updatedAt as Date,
      questions: created.persistedQuestions.map((q) => {
        const row = q as unknown as Record<string, unknown>;
        return {
          id: row.id as string,
          quizId: row.quizId as string,
          type: row.type as QuestionType,
          content: row.text as string,
          options: row.options,
          correctAnswer: (row.correctAnswer as string | null) ?? null,
          sortOrder: row.sortOrder as number,
          points: pointsBySortOrder.get(row.sortOrder as number) ?? 1,
        };
      }),
    };
  }
}
