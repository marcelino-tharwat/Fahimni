import { Router } from "express";
import { PromoCodeController } from "./promo-code.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  codeParamSchema,
  redeemPromoCodeSchema,
} from "./promo-code.validation.js";
import { redeemDtoSchema } from "./dto/redeem.dto.js";

/**
 * Promo Code Routes — Authorization Matrix
 * ─────────────────────────────────────────
 * POST   /                 → ADMIN, OPERATION   (support agent creates a code)
 * GET    /                 → ADMIN, OPERATION   (list / audit, paginated)
 * POST   /:code/validate   → STUDENT only (pre-redeem check)
 * POST   /:code/redeem      → STUDENT only (self-redeem → free PROMO enrollment)
 *
 * Every route runs authenticateMiddleware first, then authorizeMiddleware.
 * The redeem route derives the studentId from req.user.id (never the body), the
 * code from the :code param, and the target chapter from the request body; the
 * creating agent's id is taken from req.user.id on create.
 */
const router = Router();
const controller = new PromoCodeController();

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN", "OPERATION"),
  controller.createPromoCode,
);

// The list query (page/limit/isUsed) is validated inside the controller because
// Express 5 exposes req.query as read-only; validateRequest cannot reassign it.
router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN", "OPERATION"),
  controller.getAllPromoCodes,
);

router.post(
  "/:code/validate",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(codeParamSchema, "params"),
  controller.validatePromoCode,
);

// STORY-53 canonical redemption — code + chapterId in the body. Registered
// before "/:code/redeem" so the static path is matched first.
router.post(
  "/redeem",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(redeemDtoSchema),
  controller.redeemByBody,
);

router.post(
  "/:code/redeem",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(codeParamSchema, "params"),
  validateRequest(redeemPromoCodeSchema),
  controller.redeemPromoCode,
);

export default router;
