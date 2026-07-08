import { Router } from "express";
import { NotificationsController } from "./notifications.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";

const router = Router();
const controller = new NotificationsController();

router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.list,
);

router.get(
  "/unread-count",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getUnreadCount,
);

router.patch(
  "/:id/read",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.markAsRead,
);

export default router;
