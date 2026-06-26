import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  checkoutSchema,
  webhookSchema,
  paymentStatusSchema,
} from "./payment.validation.js";

const router = Router();
const controller = new PaymentController();

// Webhook route must be defined before auth-protected routes — Paymob calls
// it directly with no authentication token.
router.post(
  "/webhook",
  validateRequest(webhookSchema),
  controller.webhook,
);

router.post(
  "/checkout",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(checkoutSchema),
  controller.checkout,
);

router.get(
  "/status/:orderId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(paymentStatusSchema, "params"),
  controller.getPaymentStatus,
);

export default router;
