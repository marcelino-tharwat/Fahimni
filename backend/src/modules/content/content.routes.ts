import { Router } from "express";
import { ContentController } from "./content.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";

const router = Router();
const controller = new ContentController();

router.get(
  "/tree",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getTree,
);

router.get(
  "/student/tree",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getStudentTree,
);

router.get(
  "/student/my-courses",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getMyCourses,
);

router.get(
  "/student/lessons/:id",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getStudentLesson,
);

router.post(
  "/student/lessons/:id/view",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.incrementLessonView,
);

router.post(
  "/student/lessons/:id/complete",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.completeStudentLesson,
);

export default router;
