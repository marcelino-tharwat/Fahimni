import { Router } from "express";
import { FilesController } from "./files.controller.js";
import {
  uploadSingle,
  uploadBatch,
} from "../../shared/middlewares/upload.middleware.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";

const router = Router();
const controller = new FilesController();

router.post(
  "/upload/pdf",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  uploadSingle,
  controller.uploadSingle,
);
router.post(
  "/upload/pdf/staging",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  uploadSingle,
  controller.uploadStaging,
);
router.post(
  "/lessons/:lessonId/attach-files",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.attachFiles,
);
router.get(
  "/signed-url",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getSignedUrl,
);
router.post(
  "/upload/pdf/batch",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  uploadBatch,
  controller.uploadBatch,
);
router.delete(
  "/files",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.delete,
);

export default router;
