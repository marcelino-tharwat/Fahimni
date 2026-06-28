import { Router } from "express";
import { TutorController } from "./tutor.controller.js";
import { authenticateMiddleware } from "../../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../../shared/middlewares/validate.middleware.js";
import { askQuestionSchema } from "./dto/ask-question.dto.js";

// STORY-64 — canonical route: POST /api/tutor/ask (mounted at /api/tutor).
const router = Router();
const controller = new TutorController();

router.post(
  "/ask",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(askQuestionSchema),
  controller.ask,
);

// STORY-65 — read-only daily usage snapshot (never increments).
router.get(
  "/usage-today",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.usageToday,
);

export default router;
