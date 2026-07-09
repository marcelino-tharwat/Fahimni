import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { teacherPlanEntitlementService } from "../../modules/teacher-plans/teacher-plan-entitlement.service.js";
import type { TeacherEntitlement } from "../../modules/teacher-plans/teacher-plan-entitlement.service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      teacherEntitlement?: TeacherEntitlement;
    }
  }
}

/**
 * Teacher feature access gate. Runs AFTER authenticateMiddleware +
 * authorizeMiddleware("OPERATION"), so req.user.role is already OPERATION.
 *
 * Corrected policy — an APPROVED teacher is NOT blocked for lacking a paid
 * subscription; they fall back to the FREE plan:
 *  - PENDING_REVIEW → 403 TEACHER_PENDING_REVIEW
 *  - REJECTED       → 403 TEACHER_REJECTED
 *  - not APPROVED / inactive → 403 TEACHER_NOT_APPROVED
 *  - APPROVED + ACTIVE, no paid subscription → allowed (FREE_PLAN)
 *  - APPROVED + ACTIVE, ACTIVE paid subscription → allowed (PAID_PLAN)
 *
 * Only a Paymob-verified subscription reaches status ACTIVE; PENDING/FAILED
 * payments neither upgrade nor remove FREE access. The resolved entitlement is
 * attached to req.teacherEntitlement for downstream plan-limit checks. Teacher
 * plans / checkout / subscription-status / tracking routes are NOT gated.
 */
export async function requireActiveTeacherSubscription(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "OPERATION") {
      throw new AppError("You do not have permission to perform this action", 403, "FORBIDDEN");
    }

    const entitlement = await teacherPlanEntitlementService.resolve(userId);

    switch (entitlement.accessState) {
      case "PENDING_REVIEW":
        throw new AppError("حسابك قيد المراجعة من الإدارة", 403, "TEACHER_PENDING_REVIEW");
      case "REJECTED":
        throw new AppError("تم رفض طلب انضمامك", 403, "TEACHER_REJECTED");
      case "NOT_APPROVED":
        throw new AppError("حسابك غير مُعتمد بعد", 403, "TEACHER_NOT_APPROVED");
      // FREE_PLAN and PAID_PLAN both grant access.
      case "FREE_PLAN":
      case "PAID_PLAN":
      default:
        break;
    }

    req.teacherEntitlement = entitlement;
    next();
  } catch (error) {
    next(error);
  }
}
