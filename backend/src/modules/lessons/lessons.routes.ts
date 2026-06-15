import { Router } from "express";
import { LessonsController } from "./lessons.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createLessonSchema, updateLessonSchema } from "./lessons.validation.js";

const controller = new LessonsController();

// ── Nested routes (mounted at /chapters/:chapterId/lessons) ───────────
export const lessonNestedRouter = Router({ mergeParams: true });

lessonNestedRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(createLessonSchema),
  controller.create,
);

lessonNestedRouter.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.list,
);

// ── Standalone routes (mounted at /lessons) ───────────────────────────
export const lessonStandaloneRouter = Router();

lessonStandaloneRouter.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getById,
);

lessonStandaloneRouter.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(updateLessonSchema),
  controller.update,
);

lessonStandaloneRouter.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.delete,
);

// Default export is the nested router (for chapter.routes.ts import)
export default lessonNestedRouter;
