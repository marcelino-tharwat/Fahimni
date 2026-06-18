import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";

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

export default router;
