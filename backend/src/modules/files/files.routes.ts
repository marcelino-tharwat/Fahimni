import { Router } from "express";
import { FilesController } from "./files.controller.js";
import {
  uploadSingle,
  uploadBatch,
} from "../../shared/middlewares/upload.middleware.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";

const router = Router();
const controller = new FilesController();

router.post(
  "/upload/pdf",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  uploadSingle,
  controller.uploadSingle,
);
router.get(
  "/signed-url",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getSignedUrl,
);
router.post(
  "/upload/pdf/batch",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  uploadBatch,
  controller.uploadBatch,
);
router.delete(
  "/files",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.delete,
);

export default router;
