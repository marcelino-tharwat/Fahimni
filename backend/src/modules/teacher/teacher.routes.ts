import { Router } from "express";
import { TeacherController } from "./teacher.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { upload } from "../../shared/middlewares/upload.middleware.js";
import { updateTeacherProfileSchema } from "./teacher.validation.js";

const router = Router();
const controller = new TeacherController();

router.get(
  "/profile",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getProfile,
);

router.put(
  "/profile",
  authenticateMiddleware,
  validateRequest(updateTeacherProfileSchema),
  controller.updateProfile,
);

router.put(
  "/profile/photo",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  upload.single("photo"),
  controller.uploadPhoto,
);

router.put(
  "/profile/logo",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  upload.single("logo"),
  controller.uploadLogo,
);

export default router;
