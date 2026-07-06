import { Router } from "express";
import { TeacherRequestController } from "./teacher-request.controller.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createTeacherRequestSchema } from "./teacher-request.validation.js";
import { uploadProofDocuments } from "../../shared/middlewares/upload.middleware.js";

const router = Router();
const controller = new TeacherRequestController();

router.post(
  "/",
  uploadProofDocuments,
  validateRequest(createTeacherRequestSchema),
  controller.create,
);

export default router;
