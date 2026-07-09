import { Router } from "express";
import { MaterialsController } from "./materials.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";

const router = Router();
const controller = new MaterialsController();

router.get(
  "/lesson-materials/:materialId/download",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.downloadMaterial,
);

router.get(
  "/lesson-materials/:materialId/preview",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.previewMaterial,
);

router.get(
  "/lesson-materials/:materialId/download-statuses",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getDownloadStatuses,
);

export default router;
