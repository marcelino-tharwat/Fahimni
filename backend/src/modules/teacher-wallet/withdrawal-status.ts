import { AppError } from "../../shared/utils/AppError.js";
import type { TeacherWithdrawalStatus } from "../../generated/prisma/client.js";

/**
 * Strict forward-only withdrawal status state machine.
 *
 * Rank models how "far along" a status is. PENDING(0) < PROCESSING(1) <
 * {TRANSFERRED, REJECTED, CANCELLED}(2, all final/terminal — siblings, not
 * ordered relative to each other). A transition is classified as a
 * "step-back" specifically when the requested target has a LOWER rank than
 * the current status (moving toward an earlier/more-open state — e.g.
 * PROCESSING→PENDING, or reopening any final state back to PENDING/PROCESSING).
 * Any other disallowed transition (e.g. sibling-final-to-sibling-final, or a
 * forward move the actor isn't permitted to make directly) is a generic
 * invalid transition.
 *
 * Only admin-driven status changes go through `assertValidAdminTransition`.
 * Teacher cancellation (PENDING → CANCELLED) is a separate, narrower rule
 * enforced directly in the service (teacher-only, PENDING-only).
 */
const STATUS_RANK: Record<TeacherWithdrawalStatus, number> = {
  PENDING: 0,
  PROCESSING: 1,
  TRANSFERRED: 2,
  REJECTED: 2,
  CANCELLED: 2,
};

/** Admin-settable transitions only (CANCELLED is teacher-only, never an admin PATCH target). */
const ADMIN_ALLOWED_TRANSITIONS: Record<TeacherWithdrawalStatus, TeacherWithdrawalStatus[]> = {
  PENDING: ["PROCESSING", "TRANSFERRED", "REJECTED"],
  PROCESSING: ["TRANSFERRED", "REJECTED"],
  TRANSFERRED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const WITHDRAWAL_STEP_BACK_MESSAGE =
  "لا يمكن إرجاع طلب السحب إلى حالة سابقة";
export const WITHDRAWAL_INVALID_TRANSITION_MESSAGE =
  "لا يمكن الرجوع لحالة سابقة أو تغيير حالة طلب السحب بعد وصوله لحالة نهائية";

/**
 * Throws if `target` is not a legal admin transition from `current`. Never
 * mutates anything — callers must check this BEFORE issuing any DB write so a
 * rejected transition never touches the record (see teacher-wallet.service.ts
 * / admin-teacher-withdrawals.service.ts, both gate their update with this).
 */
export function assertValidAdminTransition(
  current: TeacherWithdrawalStatus,
  target: TeacherWithdrawalStatus,
): void {
  if (ADMIN_ALLOWED_TRANSITIONS[current].includes(target)) return;

  if (STATUS_RANK[target] < STATUS_RANK[current]) {
    throw new AppError(
      WITHDRAWAL_STEP_BACK_MESSAGE,
      409,
      "WITHDRAWAL_STATUS_STEP_BACK_NOT_ALLOWED",
    );
  }

  throw new AppError(
    WITHDRAWAL_INVALID_TRANSITION_MESSAGE,
    409,
    "WITHDRAWAL_INVALID_STATUS_TRANSITION",
  );
}
