import { Router } from "express";
import { FilesController } from "./files.controller.js";
import {
  uploadSingle,
  uploadBatch,
} from "../../shared/middlewares/upload.middleware.js";

const router = Router();
const controller = new FilesController();

router.post("/upload/pdf", uploadSingle, controller.uploadSingle);
router.get("/signed-url", controller.getSignedUrl);
router.post("/upload/pdf/batch", uploadBatch, controller.uploadBatch);

export default router;
