import { Router } from "express";
import { UserController } from "./user.controller.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createUserSchema } from "./user.validation.js";

const router = Router();
const controller = new UserController();

router.get("/", asyncHandler(controller.list));
router.post(
  "/",
  validateRequest(createUserSchema),
  asyncHandler(controller.create),
);

export default router;
