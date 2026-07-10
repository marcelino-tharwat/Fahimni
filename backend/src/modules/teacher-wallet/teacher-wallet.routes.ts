import { Router } from "express";
import { TeacherWalletController } from "./teacher-wallet.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  createWithdrawalSchema,
  updatePayoutProfileSchema,
} from "./teacher-wallet.validation.js";

const router = Router();
const controller = new TeacherWalletController();

router.get(
  "/wallet",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getWallet,
);

router.get(
  "/payout-profile",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.getPayoutProfile,
);

router.patch(
  "/payout-profile",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(updatePayoutProfileSchema),
  controller.updatePayoutProfile,
);

router.get(
  "/withdrawals",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.listWithdrawals,
);

router.post(
  "/withdrawals",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(createWithdrawalSchema),
  controller.createWithdrawal,
);

router.patch(
  "/withdrawals/:withdrawalId/cancel",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  controller.cancelWithdrawal,
);

export default router;
