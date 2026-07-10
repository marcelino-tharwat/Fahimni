import { Router } from "express";
import { ChapterController } from "./chapter.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { upload } from "../../shared/middlewares/upload.middleware.js";
import { createChapterSchema, updateChapterSchema, reorderSchema } from "./chapter.validation.js";
import { lessonNestedRouter } from "../lessons/lessons.routes.js";

const controller = new ChapterController();

// ── Nested routes (mounted at /stages/:stageId/chapters) ──────────────
export const chapterNestedRouter = Router({ mergeParams: true });

chapterNestedRouter.patch(
  "/reorder",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(reorderSchema),
  controller.reorder,
);

chapterNestedRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  upload.single("image"),
  controller.create,
);

chapterNestedRouter.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.list,
);

// ── Standalone routes (mounted at /chapters) ──────────────────────────
export const chapterStandaloneRouter = Router();

// Nested lessons (mounted at /chapters/:chapterId/lessons)
chapterStandaloneRouter.use("/:chapterId/lessons", lessonNestedRouter);

// Chapter quizzes (mounted at /chapters/:chapterId/quizzes)
chapterStandaloneRouter.get(
  "/:chapterId/quizzes",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT", "OPERATION"),
  controller.getChapterQuizzes,
);

chapterStandaloneRouter.patch(
  "/reorder",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(reorderSchema),
  controller.reorder,
);

chapterStandaloneRouter.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION", "STUDENT"),
  controller.getById,
);

chapterStandaloneRouter.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  upload.single("image"),
  validateRequest(updateChapterSchema),
  controller.update,
);

chapterStandaloneRouter.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.delete,
);

// Default export is the nested router (for stage.routes.ts import)
export default chapterNestedRouter;
