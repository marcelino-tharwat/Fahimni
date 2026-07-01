import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ConversationController } from "./conversation.controller.js";
import { AppError } from "../../../../shared/utils/AppError.js";

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
  } as Response & { statusCode: number; body: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as Response["json"];
  return res;
}

describe("ConversationController validated query", () => {
  const listConversations = vi.fn();
  const listMessages = vi.fn();
  const controller = new ConversationController({
    service: {
      createConversation: vi.fn(),
      listConversations,
      getConversation: vi.fn(),
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
      listMessages,
      sendMessage: vi.fn(),
      retryMessage: vi.fn(),
    } as never,
  });

  beforeEach(() => vi.clearAllMocks());

  it("list reads coerced query from req.validated.query", async () => {
    listConversations.mockResolvedValue({ items: [], meta: { hasMore: false } });
    const req = {
      user: { id: "student-1" },
      validated: { query: { limit: 20, archived: false } },
    } as Request;
    const res = mockRes();

    await controller.list(req, res, vi.fn() as NextFunction);

    expect(listConversations).toHaveBeenCalledWith("student-1", {
      limit: 20,
      archived: false,
    });
    expect(res.statusCode).toBe(200);
  });

  it("listMessages reads coerced query from req.validated.query", async () => {
    listMessages.mockResolvedValue({ items: [], meta: { hasMore: false } });
    const req = {
      user: { id: "student-1" },
      params: { conversationId: "conv-1" },
      validated: { query: { limit: 30 } },
    } as unknown as Request;
    const res = mockRes();

    await controller.listMessages(req, res, vi.fn() as NextFunction);

    expect(listMessages).toHaveBeenCalledWith("student-1", "conv-1", { limit: 30 });
    expect(res.statusCode).toBe(200);
  });

  it("list throws when validated query is missing", async () => {
    const req = { user: { id: "student-1" } } as Request;
    const next = vi.fn() as NextFunction;

    await controller.list(req, mockRes(), next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalled();
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBeInstanceOf(
      AppError,
    );
    expect(listConversations).not.toHaveBeenCalled();
  });
});
