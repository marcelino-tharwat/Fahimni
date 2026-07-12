import { Router } from "express";
import { TeacherController } from "./teacher.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { upload } from "../../shared/middlewares/upload.middleware.js";
import { updateTeacherProfileSchema, resubmitRequestSchema } from "./teacher.validation.js";

const router = Router();
const controller = new TeacherController();

// Review-status endpoint — accessible for ALL OPERATION users (including
// PENDING_REVIEW / REJECTED) so they can see their registration state.
// Must come BEFORE the gated routes.
router.get(
  "/review-status",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getReviewStatus,
);

router.post(
  "/registration-request/resubmit",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(resubmitRequestSchema),
  controller.resubmitRequest,
);

router.get(
  "/profile",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getProfile,
);

router.put(
  "/profile",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(updateTeacherProfileSchema),
  controller.updateProfile,
);

router.put(
  "/profile/photo",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  upload.single("photo"),
  controller.uploadPhoto,
);

router.put(
  "/profile/logo",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  upload.single("logo"),
  controller.uploadLogo,
);

export default router;
