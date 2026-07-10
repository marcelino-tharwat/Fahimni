import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import type {
  PayoutProfileDTO,
  TeacherWalletDTO,
  WithdrawalSummaryDTO,
} from "./teacher-wallet.types.js";
import type { UpdatePayoutProfileInput } from "./teacher-wallet.validation.js";

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
      // owns (PaymentTransaction -> Chapter -> Stage.teacherId). Deliberately
      // NOT TeacherSubscriptionPayment (that is the teacher's OWN plan spend,
      // not earnings from students).
      prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS", chapter: { stage: { teacherId } } },
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
}

export const teacherWalletService = new TeacherWalletService();
