import { Router } from "express";
import { TeacherPlanController } from "./teacher-plan.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createSubscriptionRequestSchema, checkoutSchema, promoPreviewSchema } from "./teacher-plan.validation.js";

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

// Primary paid flow: create a real payment checkout session. Subscription is
// NOT activated here — only after the verified Paymob webhook succeeds.
router.post(
  "/subscription/checkout",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(checkoutSchema),
  controller.checkout,
);

// Preview a TEACHER_PLAN promo (no order created, no redemption consumed).
router.post(
  "/subscription/promo/preview",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(promoPreviewSchema),
  controller.previewPromo,
);

// Fallback/manual flow: request admin review (kept as a secondary path).
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
