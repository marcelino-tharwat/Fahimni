import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../../shared/utils/asyncHandler.js";
import { AppError } from "../../../../shared/utils/AppError.js";
import { okResponse } from "../../../../shared/utils/apiResponse.js";
import { getValidatedQuery } from "../../../../shared/utils/validatedRequest.js";
import {
  conversationService,
  type ConversationService,
} from "./conversation.service.js";
import type {
  ListConversationsQuery,
  ListMessagesQuery,
  SendMessageInput,
} from "./conversation.schemas.js";

interface ConversationControllerDeps {
  service?: ConversationService;
}

export class ConversationController {
  private readonly service: ConversationService;

  constructor(deps: ConversationControllerDeps = {}) {
    this.service = deps.service ?? conversationService;
  }

  private studentId(req: Request): string {
    const id = req.user?.id;
    if (!id) {
      throw new AppError(
        "You are not logged in! Please log in to get access.",
        401,
      );
    }
    return id;
  }

  create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const conversation = await this.service.createConversation(studentId);
      res.status(201).json(okResponse("تم إنشاء المحادثة.", conversation));
    },
  );

  list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const { cursor, limit, archived } = getValidatedQuery<ListConversationsQuery>(req);
      const result = await this.service.listConversations(studentId, {
        ...(cursor !== undefined ? { cursor } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(archived !== undefined ? { archived } : {}),
      });
      res.status(200).json(okResponse("تم جلب المحادثات.", result));
    },
  );

  private param(value: string | string[] | undefined): string {
    if (typeof value === "string") return value;
    throw new AppError("معرّف غير صالح.", 400);
  }

  getOne = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const conversation = await this.service.getConversation(
        studentId,
        this.param(req.params.conversationId),
      );
      res.status(200).json(okResponse("تم جلب المحادثة.", conversation));
    },
  );

  update = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const body = req.body as { title?: string; isArchived?: boolean };
      const conversation = await this.service.updateConversation(
        studentId,
        this.param(req.params.conversationId),
        body,
      );
      res.status(200).json(okResponse("تم تحديث المحادثة.", conversation));
    },
  );

  remove = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      await this.service.deleteConversation(
        studentId,
        this.param(req.params.conversationId),
      );
      res.status(200).json(okResponse("تم حذف المحادثة."));
    },
  );

  listMessages = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const { cursor, limit } = getValidatedQuery<ListMessagesQuery>(req);
      const result = await this.service.listMessages(
        studentId,
        this.param(req.params.conversationId),
        { ...(cursor !== undefined ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) },
      );
      res.status(200).json(okResponse("تم جلب الرسائل.", result));
    },
  );

  sendMessage = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const { content, clientMessageId } = req.body as SendMessageInput;
      const result = await this.service.sendMessage(
        studentId,
        this.param(req.params.conversationId),
        content,
        clientMessageId,
      );
      res.status(200).json(okResponse("تم إرسال الرسالة.", result));
    },
  );

  retryMessage = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = this.studentId(req);
      const result = await this.service.retryMessage(
        studentId,
        this.param(req.params.conversationId),
        this.param(req.params.messageId),
      );
      res.status(200).json(okResponse("تمت إعادة المحاولة.", result));
    },
  );
}

export const conversationController = new ConversationController();
