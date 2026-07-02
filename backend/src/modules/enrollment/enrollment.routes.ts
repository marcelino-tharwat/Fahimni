import { Router } from "express";
import { EnrollmentController } from "./enrollment.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  createEnrollmentSchema,
  freeEnrollmentSchema,
  studentParamSchema,
  enrollmentIdParamSchema,
} from "./enrollment.validation.js";

/**
 * Enrollment Routes — Authorization Matrix
 * ─────────────────────────────────────────
 * POST   /                    → STUDENT only (self-enrollment)
 * POST   /free                → STUDENT only (direct free-chapter enrollment)
 * GET    /my                  → STUDENT only (own enrollments)
 * GET    /student/:studentId  → OPERATION (own chapters only), ADMIN (all)
 * PATCH  /:id/deactivate      → ADMIN only
 *
 * Every route runs authenticateMiddleware first, then authorizeMiddleware.
 * Student-scoped routes derive the studentId from req.user.id (never the body
 * or a query param), so a student can never act on another student's data.
 * OPERATION (teacher) access is further scoped inside the service layer to
 * chapters in the teacher's own stages (chapter.stage.teacherId === actorId);
 * ADMIN bypasses that ownership check.
 */
const router = Router();
const controller = new EnrollmentController();

// Static routes must be declared before any "/:param" routes so Express does
// not match literal segments (e.g. "my", "student") as a route param.
router.get(
  "/my",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getMyEnrollments,
);

router.get(
  "/student/:studentId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION", "ADMIN"),
  validateRequest(studentParamSchema, "params"),
  controller.getStudentEnrollments,
);

router.patch(
  "/:id/deactivate",
  authenticateMiddleware,
  authorizeMiddleware("ADMIN"),
  validateRequest(enrollmentIdParamSchema, "params"),
  controller.deactivate,
);

// Literal "/free" is declared before "/" so it is never shadowed. Both are
// STUDENT-only; the student id is always taken from req.user, never the body.
router.post(
  "/free",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(freeEnrollmentSchema),
  controller.createFree,
);

router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(createEnrollmentSchema),
  controller.create,
);

export default router;
