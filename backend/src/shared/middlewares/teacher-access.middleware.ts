import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { AppError } from "../utils/AppError.js";

/**
 * Teacher feature payment gate. Runs AFTER authenticateMiddleware +
 * authorizeMiddleware("OPERATION"), so req.user.role is already OPERATION.
 *
 * Access policy (backend-enforced — never rely on the frontend guard alone):
 *  - teacherApprovalState PENDING_REVIEW → 403 TEACHER_PENDING_REVIEW
 *  - teacherApprovalState REJECTED       → 403 TEACHER_REJECTED
 *  - teacherApprovalState NONE / not APPROVED → 403 TEACHER_NOT_APPROVED
 *  - APPROVED but no ACTIVE subscription → 403 TEACHER_PAYMENT_REQUIRED
 *  - APPROVED + ACTIVE subscription      → allowed
 *
 * Only a Paymob-verified subscription reaches status ACTIVE, so PENDING/FAILED
 * payments never unlock features. Teacher plans / checkout / subscription-status
 * routes do NOT use this gate (they must be reachable before payment).
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, teacherApprovalState: true },
    });
    if (!user) {
      throw new AppError("You do not have permission to perform this action", 403, "FORBIDDEN");
    }

    switch (user.teacherApprovalState) {
      case "PENDING_REVIEW":
        throw new AppError("حسابك قيد المراجعة من الإدارة", 403, "TEACHER_PENDING_REVIEW");
      case "REJECTED":
        throw new AppError("تم رفض طلب انضمامك", 403, "TEACHER_REJECTED");
      case "APPROVED":
        break;
      default:
        throw new AppError("حسابك غير مُعتمد بعد", 403, "TEACHER_NOT_APPROVED");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("حسابك غير مُعتمد بعد", 403, "TEACHER_NOT_APPROVED");
    }

    // Active subscription = a Paymob-verified subscription in ACTIVE status whose
    // period has not lapsed. PENDING/FAILED payments never produce an ACTIVE row.
    const activeSub = await prisma.teacherSubscription.findFirst({
      where: {
        teacherId: userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!activeSub) {
      throw new AppError(
        "تم قبول طلبك. اختر الباقة المناسبة وادفع لتفعيل حسابك.",
        403,
        "TEACHER_PAYMENT_REQUIRED",
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
