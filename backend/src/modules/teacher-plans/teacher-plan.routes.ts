import { Router } from "express";
import { TeacherPlanController } from "./teacher-plan.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createSubscriptionRequestSchema } from "./teacher-plan.validation.js";

const router = Router();
const controller = new TeacherPlanController();

router.get(
  "/plans",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.listPlans,
);

router.get(
  "/subscription/me",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getMySubscription,
);

router.post(
  "/subscription/requests",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(createSubscriptionRequestSchema),
  controller.createRequest,
);

router.get(
  "/subscription/requests",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.listMyRequests,
);

router.get(
  "/subscription/usage",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getMyUsage,
);

export default router;
