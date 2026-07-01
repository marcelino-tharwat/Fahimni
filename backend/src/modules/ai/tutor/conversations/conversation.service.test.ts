import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("../../../../config/database.js", () => ({ prisma: {} }));

import { ConversationService } from "./conversation.service.js";
import { TutorNotEnrolledError } from "../ai-tutor.errors.js";

const STUDENT = "student-1";
const CONV = "conv-1";

function makePrisma() {
  return {
    aiConversation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    aiMessage: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe("ConversationService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a conversation with the default Arabic title", async () => {
    const prisma = makePrisma();
    const now = new Date();
    prisma.aiConversation.create.mockResolvedValue({
      id: CONV,
      studentId: STUDENT,
      title: "محادثة جديدة",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const svc = new ConversationService({ prisma: prisma as never });
    const result = await svc.createConversation(STUDENT);

    expect(result.title).toBe("محادثة جديدة");
    expect(prisma.aiConversation.create).toHaveBeenCalledWith({
      data: { studentId: STUDENT, title: "محادثة جديدة" },
    });
  });

  it("rejects send when student is not enrolled", async () => {
    const prisma = makePrisma();
    prisma.aiConversation.findFirst.mockResolvedValue({
      id: CONV,
      studentId: STUDENT,
      title: "محادثة جديدة",
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.aiMessage.findUnique.mockResolvedValue(null);

    const svc = new ConversationService({
      prisma: prisma as never,
      enrollmentService: { hasActiveEnrollment: vi.fn().mockResolvedValue(false) },
    });

    await expect(
      svc.sendMessage(STUDENT, CONV, "سؤال كيمياء صالح للاختبار", randomUUID()),
    ).rejects.toBeInstanceOf(TutorNotEnrolledError);
  });

  it("returns idempotent result for duplicate clientMessageId", async () => {
    const prisma = makePrisma();
    const clientMessageId = randomUUID();
    const studentMessageId = randomUUID();

    prisma.aiConversation.findFirst.mockResolvedValue({
      id: CONV,
      studentId: STUDENT,
      title: "عنوان",
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.aiMessage.findUnique.mockResolvedValue({
      id: studentMessageId,
      conversationId: CONV,
      role: "STUDENT",
      content: "سؤال كيمياء صالح للاختبار",
      status: "COMPLETED",
      citations: [],
      clientMessageId,
      errorCode: null,
      createdAt: new Date(),
    });
    prisma.aiMessage.findUniqueOrThrow.mockResolvedValue({
      id: studentMessageId,
      conversationId: CONV,
      role: "STUDENT",
      content: "سؤال كيمياء صالح للاختبار",
      status: "COMPLETED",
      citations: [],
      clientMessageId,
      errorCode: null,
      createdAt: new Date(),
    });
    prisma.aiMessage.findFirst.mockResolvedValue({
      id: randomUUID(),
      role: "ASSISTANT",
      content: "إجابة",
      status: "COMPLETED",
      citations: [],
      createdAt: new Date(),
    });
    prisma.aiMessage.count.mockResolvedValue(2);
    prisma.aiConversation.findFirst
      .mockResolvedValueOnce({
        id: CONV,
        studentId: STUDENT,
        title: "عنوان",
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: CONV,
        studentId: STUDENT,
        title: "عنوان",
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

    const usageService = {
      resolveEffectiveLimit: vi.fn().mockResolvedValue(20),
      getToday: vi.fn().mockResolvedValue({
        used: 1,
        limit: 20,
        remaining: 19,
        resetsAt: "2026-07-02T00:00:00.000Z",
      }),
    };

    const svc = new ConversationService({
      prisma: prisma as never,
      usageService: usageService as never,
      tutorService: { ask: vi.fn() },
    });

    const result = await svc.sendMessage(
      STUDENT,
      CONV,
      "سؤال كيمياء صالح للاختبار",
      clientMessageId,
    );

    expect(result.studentMessage.id).toBe(studentMessageId);
    expect(usageService.resolveEffectiveLimit).toHaveBeenCalled();
  });
});
