import { randomUUID } from "node:crypto";
import { Prisma } from "../../../../generated/prisma/index.js";
import { prisma as defaultPrisma } from "../../../../config/database.js";
import { env } from "../../../../config/env.js";
import { logger } from "../../../../config/logger.js";
import { AppError } from "../../../../shared/utils/AppError.js";
import {
  aiTutorService,
  type AiTutorService,
  type TutorAskOptions,
} from "../ai-tutor.service.js";
import { tutorUsageService, type TutorUsageService } from "../tutor-usage.service.js";
import { EnrollmentService } from "../../../enrollment/enrollment.service.js";
import {
  TutorNotEnrolledError,
  TutorTimeoutError,
  TutorUnavailableError,
  TutorValidationError,
} from "../ai-tutor.errors.js";
import { TUTOR_NOT_FOUND_MESSAGE } from "../../gemini/prompts/tutor-prompt.js";
import type {
  ConversationSummaryDto,
  CursorMeta,
  MessageDto,
  SendMessageResultDto,
  TutorCitationDto,
  UsageDto,
} from "./conversation.types.js";

const ENDPOINT_ASK_OPTIONS: TutorAskOptions = {
  totalTimeoutMs: 18_000,
  retrievalTimeoutMs: 11_000,
  geminiTimeoutMs: 7_000,
};

type PrismaLike = typeof defaultPrisma;

interface ConversationServiceDeps {
  prisma?: PrismaLike;
  tutorService?: Pick<AiTutorService, "ask">;
  usageService?: Pick<
    TutorUsageService,
    | "utcDateString"
    | "tryClaim"
    | "refund"
    | "resolveEffectiveLimit"
    | "getToday"
    | "resetsAt"
  >;
  enrollmentService?: Pick<EnrollmentService, "hasActiveEnrollment">;
  askOptions?: TutorAskOptions;
}

function deriveTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return [...normalized].slice(0, 60).join("");
}

function mapCitation(raw: unknown): TutorCitationDto | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (
    typeof c.lessonId === "string" &&
    typeof c.lessonTitle === "string" &&
    typeof c.chapterName === "string"
  ) {
    return {
      lessonId: c.lessonId,
      lessonTitle: c.lessonTitle,
      chapterName: c.chapterName,
    };
  }
  return null;
}

function mapMessage(row: {
  id: string;
  role: "STUDENT" | "ASSISTANT";
  content: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  citations: unknown;
  createdAt: Date;
}): MessageDto {
  const citations = Array.isArray(row.citations)
    ? row.citations.map(mapCitation).filter((c): c is TutorCitationDto => c !== null)
    : [];
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    citations,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * STORY-69 — persistence layer around the existing tutor service.
 * Conversations/messages live in PostgreSQL; AI generation delegates to AiTutorService.
 */
export class ConversationService {
  private readonly prisma: PrismaLike;
  private readonly tutorService: Pick<AiTutorService, "ask">;
  private readonly usageService: ConversationServiceDeps["usageService"];
  private readonly enrollmentService: Pick<EnrollmentService, "hasActiveEnrollment">;
  private readonly askOptions: TutorAskOptions;

  constructor(deps: ConversationServiceDeps = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.tutorService = deps.tutorService ?? aiTutorService;
    this.usageService = deps.usageService ?? tutorUsageService;
    this.enrollmentService = deps.enrollmentService ?? new EnrollmentService();
    this.askOptions = deps.askOptions ?? ENDPOINT_ASK_OPTIONS;
  }

  async createConversation(studentId: string): Promise<ConversationSummaryDto> {
    const row = await this.prisma.aiConversation.create({
      data: { studentId, title: "محادثة جديدة" },
    });
    return this.toSummary(row, null, 0);
  }

  async listConversations(
    studentId: string,
    opts: { cursor?: string; limit?: number; archived?: boolean },
  ): Promise<{ data: ConversationSummaryDto[]; meta: CursorMeta }> {
    const limit = Math.min(
      opts.limit ?? env.TUTOR_CHAT_CONVERSATION_PAGE_SIZE,
      50,
    );

    let cursorFilter: Prisma.AiConversationWhereInput = {};
    if (opts.cursor) {
      const cursorRow = await this.prisma.aiConversation.findFirst({
        where: { id: opts.cursor, studentId, deletedAt: null },
        select: { updatedAt: true, id: true },
      });
      if (!cursorRow) {
        throw new AppError("مؤشر الصفحة غير صالح.", 400);
      }
      cursorFilter = {
        OR: [
          { updatedAt: { lt: cursorRow.updatedAt } },
          { updatedAt: cursorRow.updatedAt, id: { lt: cursorRow.id } },
        ],
      };
    }

    const where: Prisma.AiConversationWhereInput = {
      studentId,
      deletedAt: null,
      ...(opts.archived !== undefined ? { isArchived: opts.archived } : {}),
      ...cursorFilter,
    };

    const rows = await this.prisma.aiConversation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        messages: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = page.map((r) =>
      this.toSummary(
        r,
        r.messages[0]?.content ?? null,
        r._count.messages,
      ),
    );

    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
      },
    };
  }

  async getConversation(
    studentId: string,
    conversationId: string,
  ): Promise<ConversationSummaryDto> {
    const row = await this.requireConversation(studentId, conversationId);
    const [lastMessage, count] = await Promise.all([
      this.prisma.aiMessage.findFirst({
        where: { conversationId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
      this.prisma.aiMessage.count({ where: { conversationId } }),
    ]);
    return this.toSummary(row, lastMessage?.content ?? null, count);
  }

  async updateConversation(
    studentId: string,
    conversationId: string,
    patch: { title?: string; isArchived?: boolean },
  ): Promise<ConversationSummaryDto> {
    await this.requireConversation(studentId, conversationId);
    const row = await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.isArchived !== undefined ? { isArchived: patch.isArchived } : {}),
      },
    });
    const count = await this.prisma.aiMessage.count({ where: { conversationId } });
    const last = await this.prisma.aiMessage.findFirst({
      where: { conversationId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    return this.toSummary(row, last?.content ?? null, count);
  }

  async deleteConversation(studentId: string, conversationId: string): Promise<void> {
    await this.requireConversation(studentId, conversationId);
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  async listMessages(
    studentId: string,
    conversationId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<{ data: MessageDto[]; meta: CursorMeta }> {
    await this.requireConversation(studentId, conversationId);
    const limit = Math.min(opts.limit ?? env.TUTOR_CHAT_MESSAGE_PAGE_SIZE, 50);

    let cursorFilter: Prisma.AiMessageWhereInput = {};
    if (opts.cursor) {
      const cursorRow = await this.prisma.aiMessage.findFirst({
        where: { id: opts.cursor, conversationId },
        select: { createdAt: true, id: true },
      });
      if (!cursorRow) {
        throw new AppError("مؤشر الصفحة غير صالح.", 400);
      }
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ],
      };
    }

    const rows = await this.prisma.aiMessage.findMany({
      where: {
        conversationId,
        ...cursorFilter,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = (hasMore ? rows.slice(0, limit) : rows).reverse();

    return {
      data: page.map(mapMessage),
      meta: {
        hasMore,
        nextCursor: hasMore ? rows[limit - 1]!.id : null,
      },
    };
  }

  async sendMessage(
    studentId: string,
    conversationId: string,
    content: string,
    clientMessageId: string,
  ): Promise<SendMessageResultDto> {
    await this.requireConversation(studentId, conversationId);

    const existing = await this.prisma.aiMessage.findUnique({
      where: {
        conversationId_clientMessageId: { conversationId, clientMessageId },
      },
    });

    if (existing) {
      if (existing.status === "FAILED") {
        await this.prisma.aiMessage.update({
          where: { id: existing.id },
          data: { status: "PENDING", errorCode: null },
        });
        return this.processStudentMessage(studentId, conversationId, {
          ...existing,
          status: "PENDING",
          errorCode: null,
        });
      }
      return this.buildIdempotentResult(studentId, conversationId, existing.id);
    }

    const enrolled = await this.enrollmentService.hasActiveEnrollment(studentId);
    if (!enrolled) {
      throw new TutorNotEnrolledError();
    }

    let studentMessage;
    try {
      studentMessage = await this.prisma.aiMessage.create({
        data: {
          id: randomUUID(),
          conversationId,
          role: "STUDENT",
          content,
          status: "PENDING",
          clientMessageId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const dup = await this.prisma.aiMessage.findUnique({
          where: {
            conversationId_clientMessageId: { conversationId, clientMessageId },
          },
        });
        if (dup) {
          return this.buildIdempotentResult(studentId, conversationId, dup.id);
        }
      }
      throw error;
    }

    return this.processStudentMessage(studentId, conversationId, studentMessage);
  }

  private async processStudentMessage(
    studentId: string,
    conversationId: string,
    studentMessage: {
      id: string;
      content: string;
      createdAt: Date;
      role: "STUDENT" | "ASSISTANT";
      status: "PENDING" | "COMPLETED" | "FAILED";
      citations: unknown;
      clientMessageId: string | null;
      errorCode: string | null;
    },
  ): Promise<SendMessageResultDto> {
    const startedAt = Date.now();

    const limit = await this.usageService!.resolveEffectiveLimit(studentId);
    const usageDate = this.usageService!.utcDateString();
    const allowed = await this.usageService!.tryClaim(studentId, limit, usageDate);

    if (!allowed) {
      await this.prisma.aiMessage.update({
        where: { id: studentMessage.id },
        data: { status: "FAILED", errorCode: "DAILY_LIMIT_EXCEEDED" },
      });
      throw new AppError(
        "لقد تجاوزت الحد اليومي المسموح به من أسئلة المساعد الذكي. حاول غداً.",
        429,
      );
    }

    const recentMessages = await this.loadRecentContext(
      conversationId,
      studentMessage.id,
    );

    let assistantRow: {
      id: string;
      role: "STUDENT" | "ASSISTANT";
      content: string;
      status: "PENDING" | "COMPLETED" | "FAILED";
      citations: unknown;
      createdAt: Date;
    } | null = null;
    let citations: TutorCitationDto[] = [];
    let answerText = "";
    let tutorOutcome: import("../ai-tutor.service.js").TutorOutcome = "ANSWERED";

    try {
      const result = await this.tutorService.ask(studentMessage.content, studentId, {
        ...this.askOptions,
        recentMessages,
      });

      answerText = result.answer;
      tutorOutcome = result.outcome;
      citations = result.citations.map((c) => ({
        lessonId: c.lessonId,
        lessonTitle: c.lessonTitle,
        chapterName: c.chapterName,
      }));

      const [assistant, updatedStudent] = await this.prisma.$transaction([
        this.prisma.aiMessage.create({
          data: {
            id: randomUUID(),
            conversationId,
            role: "ASSISTANT",
            content: answerText,
            status: "COMPLETED",
            citations: citations as unknown as Prisma.InputJsonValue,
          },
        }),
        this.prisma.aiMessage.update({
          where: { id: studentMessage.id },
          data: { status: "COMPLETED" },
        }),
      ]);

      assistantRow = assistant;
      studentMessage = { ...studentMessage, ...updatedStudent };

      const conv = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
      });
      const isDefaultTitle = conv?.title === "محادثة جديدة";
      const studentCount = await this.prisma.aiMessage.count({
        where: { conversationId, role: "STUDENT", status: "COMPLETED" },
      });

      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(isDefaultTitle && studentCount === 1
            ? { title: deriveTitle(studentMessage.content) }
            : {}),
        },
      });
    } catch (error) {
      const errorCode =
        error instanceof TutorTimeoutError
          ? "TUTOR_TIMEOUT"
          : error instanceof TutorUnavailableError
            ? "TUTOR_UNAVAILABLE"
            : error instanceof TutorValidationError
              ? "QUESTION_INVALID"
              : "TUTOR_FAILED";

      if (
        error instanceof TutorTimeoutError ||
        error instanceof TutorUnavailableError
      ) {
        await this.usageService!.refund(studentId, usageDate).catch(() => undefined);
      }

      await this.prisma.aiMessage.update({
        where: { id: studentMessage.id },
        data: { status: "FAILED", errorCode },
      });

      logger.warn("ai_tutor_message_failed", {
        studentId,
        conversationId,
        messageId: studentMessage.id,
        errorCode,
        durationMs: Date.now() - startedAt,
      });

      throw error;
    }

    const usage = await this.buildUsage(studentId, limit);
    const conversation = await this.getConversation(studentId, conversationId);

    logger.info("ai_tutor_message_answered", {
      studentId,
      conversationId,
      messageId: studentMessage.id,
      durationMs: Date.now() - startedAt,
      citationCount: citations.length,
      outcome: tutorOutcome,
    });

    logger.info("ai_tutor_message_completed", {
      studentId,
      conversationId,
      messageId: studentMessage.id,
      durationMs: Date.now() - startedAt,
      citationCount: citations.length,
      outcome: tutorOutcome,
    });

    return {
      conversation,
      studentMessage: mapMessage({ ...studentMessage, citations: [] }),
      assistantMessage: assistantRow ? mapMessage(assistantRow) : null,
      usage,
    };
  }

  async retryMessage(
    studentId: string,
    conversationId: string,
    messageId: string,
  ): Promise<SendMessageResultDto> {
    await this.requireConversation(studentId, conversationId);

    const studentMessage = await this.prisma.aiMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
        role: "STUDENT",
        status: "FAILED",
      },
    });

    if (!studentMessage) {
      throw new AppError("لا يمكن إعادة المحاولة لهذه الرسالة.", 404);
    }

    if (!studentMessage.clientMessageId) {
      throw new AppError("لا يمكن إعادة المحاولة لهذه الرسالة.", 400);
    }

    const existingAssistant = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId,
        role: "ASSISTANT",
        createdAt: { gt: studentMessage.createdAt },
      },
    });
    if (existingAssistant) {
      return this.buildIdempotentResult(studentId, conversationId, studentMessage.id);
    }

    await this.prisma.aiMessage.update({
      where: { id: studentMessage.id },
      data: { status: "PENDING", errorCode: null },
    });

    return this.processStudentMessage(studentId, conversationId, {
      ...studentMessage,
      status: "PENDING",
      errorCode: null,
    });
  }

  private async buildIdempotentResult(
    studentId: string,
    conversationId: string,
    studentMessageId: string,
  ): Promise<SendMessageResultDto> {
    const studentMessage = await this.prisma.aiMessage.findUniqueOrThrow({
      where: { id: studentMessageId },
    });

    const assistantMessage = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId,
        role: "ASSISTANT",
        createdAt: { gte: studentMessage.createdAt },
      },
      orderBy: { createdAt: "asc" },
    });

    const limit = await this.usageService!.resolveEffectiveLimit(studentId);
    const usage = await this.buildUsage(studentId, limit);
    const conversation = await this.getConversation(studentId, conversationId);

    return {
      conversation,
      studentMessage: mapMessage(studentMessage),
      assistantMessage: assistantMessage ? mapMessage(assistantMessage) : null,
      usage,
    };
  }

  private async loadRecentContext(
    conversationId: string,
    excludeMessageId: string,
  ) {
    const rows = await this.prisma.aiMessage.findMany({
      where: {
        conversationId,
        status: "COMPLETED",
        id: { not: excludeMessageId },
      },
      orderBy: { createdAt: "desc" },
      take: env.TUTOR_CHAT_RECENT_MESSAGE_LIMIT,
      select: { role: true, content: true },
    });

    return rows
      .reverse()
      .map((m) => ({
        role: m.role as "STUDENT" | "ASSISTANT",
        content: m.content,
      }));
  }

  private async buildUsage(studentId: string, limit: number): Promise<UsageDto> {
    const snapshot = await this.usageService!.getToday(studentId, limit);
    return {
      limit: snapshot.limit,
      used: snapshot.used,
      remaining: snapshot.remaining,
      resetsAt: snapshot.resetsAt,
    };
  }

  private async requireConversation(studentId: string, conversationId: string) {
    const row = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, studentId, deletedAt: null },
    });
    if (!row) {
      throw new AppError("المحادثة غير موجودة.", 404);
    }
    return row;
  }

  private toSummary(
    row: {
      id: string;
      title: string;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    lastMessagePreview: string | null,
    messageCount: number,
  ): ConversationSummaryDto {
    const preview = lastMessagePreview
      ? lastMessagePreview.replace(/\s+/g, " ").trim().slice(0, 120)
      : null;
    return {
      id: row.id,
      title: row.title,
      isArchived: row.isArchived,
      lastMessagePreview: preview,
      messageCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const conversationService = new ConversationService();
