import { Router } from "express";
import { TeacherRequestController } from "./teacher-request.controller.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createTeacherRequestSchema, trackTeacherRequestSchema } from "./teacher-request.validation.js";
import { uploadProofDocuments } from "../../shared/middlewares/upload.middleware.js";

const router = Router();
const controller = new TeacherRequestController();

router.post(
  "/",
  uploadProofDocuments,
  validateRequest(createTeacherRequestSchema),
  controller.create,
);

// Public status tracking — requires reference + email/mobile (no auth).
router.post(
  "/track",
  validateRequest(trackTeacherRequestSchema),
  controller.track,
);

export default router;
