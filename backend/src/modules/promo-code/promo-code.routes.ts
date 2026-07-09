import { Router } from "express";
import { PromoCodeController } from "./promo-code.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  codeParamSchema,
  redeemPromoCodeSchema,
  createPromoCodeSchema,
  courseDiscountSchema,
} from "./promo-code.validation.js";
import { redeemDtoSchema } from "./dto/redeem.dto.js";

const router = Router();
const controller = new PromoCodeController();

// COURSE_PURCHASE discount preview (student). Declared before the "/:code/*"
// routes so "course" is never captured as a code param.
router.post(
  "/course/discount",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(courseDiscountSchema),
  controller.validateCourseDiscount,
);

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN", "OPERATION"),
  validateRequest(createPromoCodeSchema),
  controller.createPromoCode,
);

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
