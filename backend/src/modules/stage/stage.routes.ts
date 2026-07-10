import { Router } from "express";
import { StageController } from "./stage.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import chapterRouter from "../chapter/chapter.routes.js";

const router = Router();
const controller = new StageController();

router.get(
  "/public",
  controller.listPublic,
);

router.use("/:stageId/chapters", chapterRouter);

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

export default router;
