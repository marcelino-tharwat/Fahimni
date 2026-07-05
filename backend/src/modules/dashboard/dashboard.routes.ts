import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { teacherStudentDetailParamSchema } from "./student-engagement.validation.js";

const router = Router();
const controller = new DashboardController();

// Teachers are modeled as users with the OPERATION role (see teacher.routes.ts
// and stage.routes.ts), so the dashboard is restricted to that role.
router.get(
  "/teacher/stats",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getTeacherStats,
);

// STORY-66 — teacher student engagement stats.
router.get(
  "/teacher/students",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getTeacherStudents,
);

// STORY-75 — teacher single-student engagement detail.
router.get(
  "/teacher/students/:studentId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(teacherStudentDetailParamSchema, "params"),
  controller.getTeacherStudentDetail,
);

export default router;
