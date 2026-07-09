import { Router } from "express";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import userRoutes from "../users/user.routes.js";
import { AdminStatsController } from "./admin-stats.controller.js";
import { AdminTeachersController } from "./admin-teachers.controller.js";
import { listTeachersQuerySchema } from "./admin-teachers.validation.js";
import { AdminTeacherDetailController } from "./admin-teacher-detail.controller.js";
import {
  teacherEnrollmentsQuerySchema,
  teacherStudentsQuerySchema,
} from "./admin-teacher-detail.validation.js";
import { AdminStudentsController } from "./admin-students.controller.js";
import {
  listStudentsQuerySchema,
  studentEnrollmentsQuerySchema,
} from "./admin-students.validation.js";
import { AdminTeacherRequestsController } from "./admin-teacher-requests.controller.js";
import {
  approveRequestSchema,
  listTeacherRequestsQuerySchema,
  rejectRequestSchema,
} from "./admin-teacher-requests.validation.js";
import { AdminPlansController } from "./admin-plans.controller.js";
import {
  createPlanSchema,
  listPlansQuerySchema,
  recommendedChangeSchema,
  reorderSchema,
  statusChangeSchema,
  updatePlanSchema,
} from "./admin-plans.validation.js";
import { AdminUsersController } from "./admin-users.controller.js";
import { listUsersQuerySchema } from "./admin-users.validation.js";

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
const teachersController = new AdminTeachersController();
const teacherDetailController = new AdminTeacherDetailController();
const studentsController = new AdminStudentsController();
const teacherRequestsController = new AdminTeacherRequestsController();
const plansController = new AdminPlansController();
const adminUsersController = new AdminUsersController();

// The convention: authenticate first, then require the ADMIN role. Applies to
// every route and every sub-router declared after this line.
router.use(authenticateMiddleware, authorizeMiddleware("ADMIN"));

/** Global platform metrics for the admin dashboard (overview only). */
router.get("/stats", asyncHandler(statsController.getStats));

/** Paginated teacher management list (User.role = OPERATION) with per-teacher stats. */
router.get(
  "/teachers",
  validateRequest(listTeachersQuerySchema, "query"),
  asyncHandler(teachersController.list),
);

// ── Teacher detail (all scoped to :teacherId; OPERATION-role or 404) ──────────
// Registered after the static "/teachers" route above. Each handler resolves the
// teacher (404 if missing / non-OPERATION) before returning safe, teacher-scoped
// data — course revenue and subscription payments are kept as separate figures.
router.get("/teachers/:teacherId", asyncHandler(teacherDetailController.getDetail));
router.get(
  "/teachers/:teacherId/students",
  validateRequest(teacherStudentsQuerySchema, "query"),
  asyncHandler(teacherDetailController.getStudents),
);
router.get(
  "/teachers/:teacherId/enrollments",
  validateRequest(teacherEnrollmentsQuerySchema, "query"),
  asyncHandler(teacherDetailController.getEnrollments),
);
router.get("/teachers/:teacherId/content", asyncHandler(teacherDetailController.getContent));
router.get("/teachers/:teacherId/revenue", asyncHandler(teacherDetailController.getRevenue));
router.get("/teachers/:teacherId/subscription", asyncHandler(teacherDetailController.getSubscription));
router.get("/teachers/:teacherId/ai-usage", asyncHandler(teacherDetailController.getAiUsage));

// ── Students management (global). Static list route before dynamic :studentId. ──
// Each detail handler resolves the student (404 if missing / non-STUDENT) and
// returns safe, non-sensitive fields only.
router.get(
  "/students",
  validateRequest(listStudentsQuerySchema, "query"),
  asyncHandler(studentsController.list),
);
router.get("/students/:studentId", asyncHandler(studentsController.getDetail));
router.get(
  "/students/:studentId/enrollments",
  validateRequest(studentEnrollmentsQuerySchema, "query"),
  asyncHandler(studentsController.getEnrollments),
);
router.get("/students/:studentId/payments", asyncHandler(studentsController.getPayments));
router.get("/students/:studentId/learning-summary", asyncHandler(studentsController.getLearningSummary));

// ── Teacher registration requests review. Static list before dynamic :requestId. ──
// Read is safe (no raw storage paths); approve/reject are PENDING-only, write an
// AuditLog, and never expose passwords/tokens.
router.get(
  "/teacher-requests",
  validateRequest(listTeacherRequestsQuerySchema, "query"),
  asyncHandler(teacherRequestsController.list),
);
router.get("/teacher-requests/:requestId", asyncHandler(teacherRequestsController.getDetail));
router.get(
  "/teacher-requests/:requestId/documents/:documentIndex/signed-url",
  asyncHandler(teacherRequestsController.getDocumentSignedUrl),
);
router.patch(
  "/teacher-requests/:requestId/approve",
  validateRequest(approveRequestSchema, "body"),
  asyncHandler(teacherRequestsController.approve),
);
router.patch(
  "/teacher-requests/:requestId/reject",
  validateRequest(rejectRequestSchema, "body"),
  asyncHandler(teacherRequestsController.reject),
);

// ── Plans catalog & mutations ──
router.get(
  "/plans",
  validateRequest(listPlansQuerySchema, "query"),
  asyncHandler(plansController.list),
);
router.post(
  "/plans",
  validateRequest(createPlanSchema, "body"),
  asyncHandler(plansController.create),
);
// Static route before dynamic :planId
router.patch(
  "/plans/reorder",
  validateRequest(reorderSchema, "body"),
  asyncHandler(plansController.reorder),
);
router.get("/plans/:planId", asyncHandler(plansController.getDetail));
router.patch(
  "/plans/:planId",
  validateRequest(updatePlanSchema, "body"),
  asyncHandler(plansController.update),
);
router.patch(
  "/plans/:planId/status",
  validateRequest(statusChangeSchema, "body"),
  asyncHandler(plansController.changeStatus),
);
router.patch(
  "/plans/:planId/recommended",
  validateRequest(recommendedChangeSchema, "body"),
  asyncHandler(plansController.changeRecommended),
);

/** Lightweight identity check — confirms the caller is an authenticated admin. */
router.get("/me", (req, res) => {
  res.status(200).json(
    okResponse("Admin session verified", {
      id: req.user!.id,
      role: req.user!.role,
    }),
  );
});

// ── Admin user management (global list + detail). ──
// Static list route before dynamic :userId. Safe fields only — never returns
// password / tokenVersion / refresh tokens.
router.get(
  "/users",
  validateRequest(listUsersQuerySchema, "query"),
  asyncHandler(adminUsersController.list),
);
router.get("/users/:userId", asyncHandler(adminUsersController.getDetail));

// User management under the admin namespace (`/api/admin/users`). userRoutes
// also carries its own ADMIN guards, so this is intentional defense-in-depth.
router.use("/users", userRoutes);

export default router;
