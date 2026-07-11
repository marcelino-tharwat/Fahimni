import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { TeacherWithdrawalStatus } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import type { AuditLogAction } from "../../shared/services/auditLog.service.js";
import { assertValidAdminTransition } from "../teacher-wallet/withdrawal-status.js";
import type {
  AdminWithdrawalListItem,
  Paginated,
  PayoutMethodSnapshotDTO,
} from "./admin-teacher-withdrawals.types.js";
import type {
  ListAdminWithdrawalsQuery,
  UpdateWithdrawalStatusInput,
} from "./admin-teacher-withdrawals.validation.js";
import { sendTransactionalEmail } from "../email/transactional-email.helpers.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const withdrawalSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  payoutMethodSnapshot: true,
  teacherNote: true,
  adminNote: true,
  requestedAt: true,
  processedAt: true,
  transferredAt: true,
  cancelledAt: true,
  reviewedById: true,
  teacher: { select: { id: true, fullName: true, email: true, locale: true } },
} as const;

type WithdrawalRow = {
  id: string;
  amount: number;
  currency: string;
  status: TeacherWithdrawalStatus;
  payoutMethodSnapshot: Prisma.JsonValue;
  teacherNote: string | null;
  adminNote: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  transferredAt: Date | null;
  cancelledAt: Date | null;
  reviewedById: string | null;
  teacher: { id: string; fullName: string; email: string; locale: string };
};

function toSnapshotDTO(value: Prisma.JsonValue): PayoutMethodSnapshotDTO | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  return {
    instaPayHandle: (obj.instaPayHandle as string | undefined) ?? null,
    vodafoneCashNumber: (obj.vodafoneCashNumber as string | undefined) ?? null,
  };
}

/**
 * Admin Teacher Withdrawal Requests review model. ADMIN-only, read + strict
 * forward-only status transitions (see ../teacher-wallet/withdrawal-status.ts
 * for the transition guard — shared with the teacher-cancel path so the rule
 * is defined exactly once). No provider payloads or payout secrets are ever
 * exposed here — only the safe payoutMethodSnapshot fields.
 */
export class AdminTeacherWithdrawalsService {
  private toListItem(
    row: WithdrawalRow,
    reviewerName: string | null,
  ): AdminWithdrawalListItem {
    return {
      id: row.id,
      teacher: row.teacher,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      payoutMethodSnapshot: toSnapshotDTO(row.payoutMethodSnapshot),
      teacherNote: row.teacherNote,
      adminNote: row.adminNote,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      transferredAt: row.transferredAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      reviewedBy:
        row.reviewedById && reviewerName != null
          ? { id: row.reviewedById, fullName: reviewerName, email: "" }
          : null,
    };
  }

  private async reviewerNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  async list(
    query: ListAdminWithdrawalsQuery,
  ): Promise<Paginated<AdminWithdrawalListItem>> {
    const { page, limit, q, status, teacherId } = query;
    const where: Prisma.TeacherWithdrawalRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(q
        ? {
            teacher: {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.teacherWithdrawalRequest.count({ where }),
      prisma.teacherWithdrawalRequest.findMany({
        where,
        select: withdrawalSelect,
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const names = await this.reviewerNames(
      rows.map((r) => r.reviewedById).filter((v): v is string => v != null),
    );
    const data = rows.map((r) =>
      this.toListItem(r, r.reviewedById ? names.get(r.reviewedById) ?? null : null),
    );

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async loadWithdrawal(withdrawalId: string): Promise<WithdrawalRow> {
    if (!UUID_RE.test(withdrawalId)) {
      throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
    }
    const row = await prisma.teacherWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: withdrawalSelect,
    });
    if (!row) {
      throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
    }
    return row;
  }

  async getDetail(withdrawalId: string): Promise<AdminWithdrawalListItem> {
    const row = await this.loadWithdrawal(withdrawalId);
    const reviewerName = row.reviewedById
      ? (await this.reviewerNames([row.reviewedById])).get(row.reviewedById) ?? null
      : null;
    return this.toListItem(row, reviewerName);
  }

  /**
   * PATCH /api/admin/teacher-withdrawals/:withdrawalId/status — strict
   * forward-only transition (PENDING→PROCESSING/TRANSFERRED/REJECTED,
   * PROCESSING→TRANSFERRED/REJECTED only). Validation runs BEFORE any DB
   * write, so a rejected transition never modifies the record. The write
   * itself is additionally guarded by a conditional `updateMany` (current
   * status must still match what was just validated) to close the race
   * window between the load and the write.
   */
  async updateStatus(
    withdrawalId: string,
    reviewerId: string,
    input: UpdateWithdrawalStatusInput,
  ): Promise<AdminWithdrawalListItem> {
    const row = await this.loadWithdrawal(withdrawalId);
    const target = input.status as TeacherWithdrawalStatus;

    // Throws with the correct WITHDRAWAL_STATUS_STEP_BACK_NOT_ALLOWED /
    // WITHDRAWAL_INVALID_STATUS_TRANSITION code — nothing has been written yet.
    assertValidAdminTransition(row.status, target);

    const now = new Date();
    const data: Record<string, unknown> = {
      status: target,
      reviewedById: reviewerId,
    };
    if (input.adminNote !== undefined) data.adminNote = input.adminNote;
    if (target === "PROCESSING" && !row.processedAt) data.processedAt = now;
    if (target === "TRANSFERRED") {
      data.transferredAt = now;
      if (!row.processedAt) data.processedAt = now;
    }
    if (target === "REJECTED") {
      // Schema has no dedicated "rejectedAt" column — cancelledAt already
      // means "this request stopped being open/held" and is reused here as
      // the release timestamp (no migration needed for this feature).
      data.cancelledAt = now;
    }

    const auditAction: AuditLogAction =
      target === "PROCESSING"
        ? "ADMIN_WITHDRAWAL_PROCESSING"
        : target === "TRANSFERRED"
          ? "ADMIN_WITHDRAWAL_TRANSFERRED"
          : "ADMIN_WITHDRAWAL_REJECTED";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.teacherWithdrawalRequest.updateMany({
        where: { id: withdrawalId, status: row.status },
        data: data as Prisma.TeacherWithdrawalRequestUncheckedUpdateManyInput,
      });
      if (result.count === 0) {
        // Lost a race — status changed between load and write. Re-validate
        // against the fresh status for an accurate, specific error code.
        const fresh = await tx.teacherWithdrawalRequest.findUniqueOrThrow({
          where: { id: withdrawalId },
          select: { status: true },
        });
        assertValidAdminTransition(fresh.status, target);
        throw new AppError(
          "لا يمكن الرجوع لحالة سابقة أو تغيير حالة طلب السحب بعد وصوله لحالة نهائية",
          409,
          "WITHDRAWAL_INVALID_STATUS_TRANSITION",
        );
      }

      await auditLogService.record(
        {
          action: auditAction,
          resourceType: "TEACHER_WITHDRAWAL_REQUEST",
          resourceId: withdrawalId,
          actorId: reviewerId,
          actorType: "ADMIN",
          scopeTeacherId: row.teacher.id,
          details: {
            fromStatus: row.status,
            toStatus: target,
            ...(input.adminNote ? { adminNote: input.adminNote } : {}),
          },
        },
        tx,
      );

      return tx.teacherWithdrawalRequest.findUniqueOrThrow({
        where: { id: withdrawalId },
        select: withdrawalSelect,
      });
    });

    const reviewerName = (await this.reviewerNames([reviewerId])).get(reviewerId) ?? null;
    await sendTransactionalEmail({
      to: updated.teacher.email,
      template: "teacherWithdrawalStatusChanged",
      locale: updated.teacher.locale,
      data: {
        amount: `${updated.amount} ${updated.currency}`,
        currency: updated.currency,
        oldStatus: row.status,
        newStatus: updated.status,
        adminNote: input.adminNote,
        withdrawalsUrl: "/teacher/withdrawals",
      },
      metadata: { withdrawalId, fromStatus: row.status, toStatus: updated.status },
      entityType: "TeacherWithdrawalRequest",
      entityId: withdrawalId,
      dedupeKey: `${withdrawalId}:${row.status}:${updated.status}:teacherWithdrawalStatusChanged`,
    });
    return this.toListItem(updated, reviewerName);
  }
}

export const adminTeacherWithdrawalsService = new AdminTeacherWithdrawalsService();
