import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import type {
  PayoutMethodSnapshotDTO,
  PayoutProfileDTO,
  TeacherWalletDTO,
  TeacherWithdrawalListItemDTO,
  WithdrawalSummaryDTO,
} from "./teacher-wallet.types.js";
import type {
  CreateWithdrawalInput,
  UpdatePayoutProfileInput,
} from "./teacher-wallet.validation.js";
import { sendTransactionalEmail } from "../email/transactional-email.helpers.js";

const HELD_STATUSES = ["PENDING", "PROCESSING"] as const;
const LATEST_WITHDRAWALS_LIMIT = 10;

function toPayoutProfileDTO(profile: {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
  payoutMethodUpdatedAt: Date | null;
}): PayoutProfileDTO {
  return {
    instaPayHandle: profile.instaPayHandle,
    vodafoneCashNumber: profile.vodafoneCashNumber,
    payoutMethodUpdatedAt: profile.payoutMethodUpdatedAt?.toISOString() ?? null,
  };
}

export class TeacherWalletService {
  /**
   * GET /api/teacher/wallet — calculated wallet snapshot. Never manually
   * edited: totalConfirmedEarnings comes from SUCCESS student PaymentTransaction
   * rows on this teacher's chapters (never teacher-plan subscription payments);
   * availableBalance always derives from earnings minus held/transferred
   * withdrawals and is clamped at zero.
   */
  public async getWallet(teacherId: string): Promise<TeacherWalletDTO> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: {
        instaPayHandle: true,
        vodafoneCashNumber: true,
        payoutMethodUpdatedAt: true,
      },
    });
    if (!profile) {
      throw new AppError("Teacher profile not found", 404);
    }

    const [earningsAgg, withdrawalGroups, latestRows] = await Promise.all([
      // Teacher earnings = SUCCESS student payments on chapters this teacher
      // owns directly (PaymentTransaction -> Chapter.teacherId — the canonical
      // ownership field; Chapter no longer only inherits ownership via its
      // Stage). Deliberately NOT TeacherSubscriptionPayment (that is the
      // teacher's OWN plan spend, not earnings from students).
      prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS", chapter: { teacherId } },
        _sum: { amount: true },
      }),
      prisma.teacherWithdrawalRequest.groupBy({
        by: ["status"],
        where: { teacherId },
        _sum: { amount: true },
      }),
      prisma.teacherWithdrawalRequest.findMany({
        where: { teacherId },
        orderBy: { requestedAt: "desc" },
        take: LATEST_WITHDRAWALS_LIMIT,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          requestedAt: true,
          processedAt: true,
          transferredAt: true,
          cancelledAt: true,
          teacherNote: true,
        },
      }),
    ]);

    const totalConfirmedEarnings = earningsAgg._sum.amount ?? 0;

    const sumByStatus = (statuses: readonly string[]): number =>
      withdrawalGroups
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);

    const completedWithdrawals = sumByStatus(["TRANSFERRED"]);
    const heldWithdrawals = sumByStatus(HELD_STATUSES);

    // CANCELLED / REJECTED release held money automatically — they are simply
    // excluded from both sums above, so they never reduce availableBalance.
    const availableBalance = Math.max(
      0,
      totalConfirmedEarnings - completedWithdrawals - heldWithdrawals,
    );

    const latestWithdrawals: WithdrawalSummaryDTO[] = latestRows.map((w) => ({
      id: w.id,
      amount: w.amount,
      currency: w.currency,
      status: w.status,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      transferredAt: w.transferredAt?.toISOString() ?? null,
      cancelledAt: w.cancelledAt?.toISOString() ?? null,
      teacherNote: w.teacherNote,
    }));

    return {
      totalConfirmedEarnings,
      availableBalance,
      heldWithdrawals,
      completedWithdrawals,
      currency: "EGP",
      latestWithdrawals,
      payoutProfile: toPayoutProfileDTO(profile),
    };
  }

  /** GET /api/teacher/payout-profile */
  public async getPayoutProfile(teacherId: string): Promise<PayoutProfileDTO> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: {
        instaPayHandle: true,
        vodafoneCashNumber: true,
        payoutMethodUpdatedAt: true,
      },
    });
    if (!profile) {
      throw new AppError("Teacher profile not found", 404);
    }
    return toPayoutProfileDTO(profile);
  }

  /** PATCH /api/teacher/payout-profile — zod already trimmed/validated values. */
  public async updatePayoutProfile(
    teacherId: string,
    input: UpdatePayoutProfileInput,
  ): Promise<PayoutProfileDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const data: {
      instaPayHandle?: string;
      vodafoneCashNumber?: string;
      payoutMethodUpdatedAt?: Date;
    } = {};
    if (input.instaPayHandle !== undefined) {
      data.instaPayHandle = input.instaPayHandle;
    }
    if (input.vodafoneCashNumber !== undefined) {
      data.vodafoneCashNumber = input.vodafoneCashNumber;
    }
    data.payoutMethodUpdatedAt = new Date();

    const updated = await prisma.teacherProfile.update({
      where: { userId: teacherId },
      data,
      select: {
        instaPayHandle: true,
        vodafoneCashNumber: true,
        payoutMethodUpdatedAt: true,
      },
    });

    await auditLogService.record({
      action: "TEACHER_PAYOUT_METHOD_UPDATED",
      resourceType: "TEACHER_PROFILE",
      resourceId: teacherId,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: {
        instaPayHandleChanged: input.instaPayHandle !== undefined,
        vodafoneCashNumberChanged: input.vodafoneCashNumber !== undefined,
      },
    });

    return toPayoutProfileDTO(updated);
  }

  /** GET /api/teacher/withdrawals — the teacher's own requests, newest first. */
  public async listWithdrawals(teacherId: string): Promise<TeacherWithdrawalListItemDTO[]> {
    const rows = await prisma.teacherWithdrawalRequest.findMany({
      where: { teacherId },
      orderBy: { requestedAt: "desc" },
    });
    return rows.map((r) => this.toWithdrawalListItemDTO(r));
  }

  /**
   * POST /api/teacher/withdrawals — request a withdrawal from available
   * balance. The balance re-check and the insert happen inside one
   * transaction, serialized per-teacher via a Postgres advisory lock
   * (released automatically at commit/rollback), so two concurrent requests
   * for the same teacher can never together exceed availableBalance.
   */
  public async createWithdrawal(
    teacherId: string,
    input: CreateWithdrawalInput,
  ): Promise<TeacherWithdrawalListItemDTO> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: { instaPayHandle: true, vodafoneCashNumber: true },
    });
    if (!profile) {
      throw new AppError("Teacher profile not found", 404);
    }
    if (!profile.instaPayHandle && !profile.vodafoneCashNumber) {
      throw new AppError(
        "أضف بيانات التحويل أولًا من ملفك المالي",
        400,
        "WITHDRAWAL_PAYOUT_METHOD_REQUIRED",
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      // Serialize concurrent withdrawal creation for THIS teacher only (the
      // hash key is teacher-scoped, so other teachers are never blocked).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${teacherId}))`;

      const [earningsAgg, withdrawalGroups] = await Promise.all([
        tx.paymentTransaction.aggregate({
          where: { status: "SUCCESS", chapter: { teacherId } },
          _sum: { amount: true },
        }),
        tx.teacherWithdrawalRequest.groupBy({
          by: ["status"],
          where: { teacherId },
          _sum: { amount: true },
        }),
      ]);
      const totalConfirmedEarnings = earningsAgg._sum.amount ?? 0;
      const sumByStatus = (statuses: readonly string[]): number =>
        withdrawalGroups
          .filter((g) => statuses.includes(g.status))
          .reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);
      const transferred = sumByStatus(["TRANSFERRED"]);
      const held = sumByStatus(HELD_STATUSES);
      const availableBalance = Math.max(0, totalConfirmedEarnings - transferred - held);

      if (input.amount > availableBalance) {
        throw new AppError(
          "المبلغ المطلوب أكبر من الرصيد المتاح",
          400,
          "WITHDRAWAL_EXCEEDS_AVAILABLE_BALANCE",
        );
      }

      const payoutMethodSnapshot: PayoutMethodSnapshotDTO = {
        instaPayHandle: profile.instaPayHandle,
        vodafoneCashNumber: profile.vodafoneCashNumber,
      };

      const row = await tx.teacherWithdrawalRequest.create({
        data: {
          teacherId,
          amount: input.amount,
          currency: "EGP",
          status: "PENDING",
          payoutMethodSnapshot: payoutMethodSnapshot as unknown as Prisma.InputJsonValue,
          teacherNote: input.teacherNote ?? null,
        },
      });

      await auditLogService.record(
        {
          action: "TEACHER_WITHDRAWAL_REQUESTED",
          resourceType: "TEACHER_WITHDRAWAL_REQUEST",
          resourceId: row.id,
          actorId: teacherId,
          actorType: "TEACHER",
          scopeTeacherId: teacherId,
          details: { amount: input.amount },
        },
        tx,
      );

      return row;
    });

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { email: true, locale: true },
    });
    await sendTransactionalEmail({
      to: teacher?.email ?? null,
      template: "teacherWithdrawalRequested",
      locale: teacher?.locale ?? null,
      data: {
        amount: `${created.amount} ${created.currency}`,
        currency: created.currency,
        status: "PENDING",
        payoutMethodSnapshot: created.payoutMethodSnapshot,
        withdrawalsUrl: "/teacher/withdrawals",
      },
      metadata: { withdrawalId: created.id },
    });

    return this.toWithdrawalListItemDTO(created);
  }

  /**
   * PATCH /api/teacher/withdrawals/:withdrawalId/cancel — teacher-only,
   * PENDING-only. The conditional `updateMany` guard is defense-in-depth
   * against a race between the ownership/status check and the write; a lost
   * race reports the same error and never partially modifies the record.
   */
  public async cancelWithdrawal(
    teacherId: string,
    withdrawalId: string,
  ): Promise<TeacherWithdrawalListItemDTO> {
    const existing = await prisma.teacherWithdrawalRequest.findFirst({
      where: { id: withdrawalId, teacherId },
    });
    if (!existing) {
      throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
    }
    if (existing.status !== "PENDING") {
      throw new AppError(
        "لا يمكن إلغاء طلب السحب في هذه الحالة",
        409,
        "WITHDRAWAL_CANNOT_BE_CANCELLED",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.teacherWithdrawalRequest.updateMany({
        where: { id: withdrawalId, teacherId, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (result.count === 0) {
        throw new AppError(
          "لا يمكن إلغاء طلب السحب في هذه الحالة",
          409,
          "WITHDRAWAL_CANNOT_BE_CANCELLED",
        );
      }

      await auditLogService.record(
        {
          action: "TEACHER_WITHDRAWAL_CANCELLED",
          resourceType: "TEACHER_WITHDRAWAL_REQUEST",
          resourceId: withdrawalId,
          actorId: teacherId,
          actorType: "TEACHER",
          scopeTeacherId: teacherId,
        },
        tx,
      );

      return tx.teacherWithdrawalRequest.findUniqueOrThrow({ where: { id: withdrawalId } });
    });

    return this.toWithdrawalListItemDTO(updated);
  }

  private toWithdrawalListItemDTO(row: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    payoutMethodSnapshot: Prisma.JsonValue;
    teacherNote: string | null;
    requestedAt: Date;
    processedAt: Date | null;
    transferredAt: Date | null;
    cancelledAt: Date | null;
  }): TeacherWithdrawalListItemDTO {
    const snapshot = row.payoutMethodSnapshot;
    const isPlainObject =
      snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot);
    const payoutMethodSnapshot: PayoutMethodSnapshotDTO | null = isPlainObject
      ? {
          instaPayHandle:
            ((snapshot as Record<string, unknown>).instaPayHandle as string | undefined) ?? null,
          vodafoneCashNumber:
            ((snapshot as Record<string, unknown>).vodafoneCashNumber as string | undefined) ??
            null,
        }
      : null;

    return {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      payoutMethodSnapshot,
      teacherNote: row.teacherNote,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      transferredAt: row.transferredAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    };
  }
}

export const teacherWalletService = new TeacherWalletService();
