import { Router } from "express";
import { StageController } from "./stage.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createStageSchema, updateStageSchema, reorderSchema } from "./stage.validation.js";
import chapterRouter from "../chapter/chapter.routes.js";

const router = Router();
const controller = new StageController();

router.get(
  "/public",
  controller.listPublic,
);

router.use("/:stageId/chapters", chapterRouter);

router.patch(
  "/reorder",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(reorderSchema),
  controller.reorder,
);

router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.list,
);

router.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getById,
);

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(createStageSchema),
  controller.create,
);

router.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(updateStageSchema),
  controller.update,
);

router.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.delete,
);

export default router;
