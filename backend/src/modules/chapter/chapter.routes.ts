import { Router } from "express";
import { ChapterController } from "./chapter.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createChapterSchema, updateChapterSchema } from "./chapter.validation.js";

const controller = new ChapterController();

// ── Nested routes (mounted at /stages/:stageId/chapters) ──────────────
export const chapterNestedRouter = Router({ mergeParams: true });

chapterNestedRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(createChapterSchema),
  controller.create,
);

chapterNestedRouter.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.list,
);

// ── Standalone routes (mounted at /chapters) ──────────────────────────
export const chapterStandaloneRouter = Router();

chapterStandaloneRouter.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getById,
);

chapterStandaloneRouter.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(updateChapterSchema),
  controller.update,
);

chapterStandaloneRouter.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.delete,
);

// Default export is the nested router (for stage.routes.ts import)
export default chapterNestedRouter;
