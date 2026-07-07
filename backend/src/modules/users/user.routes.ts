import { Router } from "express";
import { UserController } from "./user.controller.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import { createUserSchema, listUsersQuerySchema } from "./user.validation.js";

/**
 * User management routes — ADMIN only.
 * ────────────────────────────────────
 * GET  /  → list users (paginated, safe fields only)
 * POST /  → create a user (any role)
 *
 * SECURITY: both routes were previously unauthenticated, which allowed anyone
 * to create a fully-privileged ADMIN account and to read the full user list.
 * They now require authentication and the ADMIN role. Role assignment is only
 * trusted here because the caller is a verified admin (req.user is DB-sourced
 * by authenticateMiddleware). Public self-registration lives in the auth module
 * and can only ever create STUDENT/OPERATION — never ADMIN.
 *
 * This router is also mounted under the shared /api/admin convention router.
 */
const router = Router();
const controller = new UserController();

router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN"),
  validateRequest(listUsersQuerySchema, "query"),
  asyncHandler(controller.list),
);

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN"),
  validateRequest(createUserSchema),
  asyncHandler(controller.create),
);

export default router;
