import { Router } from "express";
import { conversationController } from "./conversation.controller.js";
import { authenticateMiddleware } from "../../../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../../../shared/middlewares/validate.middleware.js";
import {
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  updateConversationSchema,
} from "./conversation.schemas.js";

const router = Router();

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  conversationController.create,
);

router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(listConversationsQuerySchema, "query"),
  conversationController.list,
);

router.get(
  "/:conversationId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  conversationController.getOne,
);

router.patch(
  "/:conversationId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(updateConversationSchema),
  conversationController.update,
);

router.delete(
  "/:conversationId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  conversationController.remove,
);

router.get(
  "/:conversationId/messages",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(listMessagesQuerySchema, "query"),
  conversationController.listMessages,
);

router.post(
  "/:conversationId/messages",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(sendMessageSchema),
  conversationController.sendMessage,
);

router.post(
  "/:conversationId/messages/:messageId/retry",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  conversationController.retryMessage,
);

export default router;
