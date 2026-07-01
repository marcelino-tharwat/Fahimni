import { Router } from "express";
import { PromoCodeController } from "./promo-code.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  codeParamSchema,
  redeemPromoCodeSchema,
  createPromoCodeSchema,
} from "./promo-code.validation.js";
import { redeemDtoSchema } from "./dto/redeem.dto.js";

const router = Router();
const controller = new PromoCodeController();

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
