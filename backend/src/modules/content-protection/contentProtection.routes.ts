import { Router } from "express";
import { ContentProtectionController } from "./contentProtection.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { contentProtectionRateLimiter } from "./contentProtectionRateLimiter.js";

const router = Router();
const controller = new ContentProtectionController();

router.post(
  "/content-protection/events",
  authenticateMiddleware,
  contentProtectionRateLimiter,
  controller.reportEvent,
);

export default router;
