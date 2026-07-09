import { Router } from "express";
import { AiController } from "./ai.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { indexLessonSchema, similarityQuerySchema } from "./ai.validation.js";

const router = Router();
const controller = new AiController();

router.post(
  "/index/:lessonId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(indexLessonSchema),
  controller.indexLesson,
);

router.post(
  "/reindex/:lessonId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.reindexLesson,
);

router.get(
  "/status/:lessonId",
  authenticateMiddleware,
  controller.getStatus,
);

router.post(
  "/search",
  authenticateMiddleware,
  validateRequest(similarityQuerySchema),
  controller.similaritySearch,
);

export default router;
