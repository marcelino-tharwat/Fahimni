import { Router } from "express";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import userRoutes from "../users/user.routes.js";
import { AdminStatsController } from "./admin-stats.controller.js";

/**
 * Admin router — the canonical home for the Admin Module (`/api/admin/*`).
 *
 * CONVENTION (must be followed by every admin sub-router mounted here):
 *   1. Every admin route is authenticated via authenticateMiddleware, which
 *      re-loads the user from the DB — so req.user.role is DB-sourced and is
 *      never trusted from the client / token payload.
 *   2. Every admin route is restricted to the ADMIN role via
 *      authorizeMiddleware("ADMIN").
 *
 * Both guards are applied ONCE here at the router level, so any sub-router
 * mounted below (`router.use("/thing", thingRouter)`) inherits ADMIN-only
 * protection automatically. New admin features should be added by mounting
 * their sub-router here rather than wiring the guards ad-hoc.
 */
const router = Router();
const statsController = new AdminStatsController();

// The convention: authenticate first, then require the ADMIN role. Applies to
// every route and every sub-router declared after this line.
router.use(authenticateMiddleware, authorizeMiddleware("ADMIN"));

/** Global platform metrics for the admin dashboard (overview only). */
router.get("/stats", asyncHandler(statsController.getStats));

/** Lightweight identity check — confirms the caller is an authenticated admin. */
router.get("/me", (req, res) => {
  res.status(200).json(
    okResponse("Admin session verified", {
      id: req.user!.id,
      role: req.user!.role,
    }),
  );
});

// User management under the admin namespace (`/api/admin/users`). userRoutes
// also carries its own ADMIN guards, so this is intentional defense-in-depth.
router.use("/users", userRoutes);

export default router;
