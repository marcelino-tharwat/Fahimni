import type { Prisma, PrismaClient, PromoScope } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface PromoPricing {
  amountBefore: number;
  discount: number;
  amountAfter: number;
}

export interface ValidateContext {
  scope: PromoScope;
  amount: number;
  userId: string;
  planId?: string;
  billingInterval?: "MONTHLY" | "YEARLY";
  now?: Date;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Shared, server-side promo validation + discount pricing for the scope-separated
 * PlatformPromoCode model. All discount math is computed here — the frontend
 * value is never trusted. COURSE_PURCHASE and TEACHER_PLAN codes can never be
 * cross-used (scope is enforced). Never mutates on validation; use recordRedemption
 * to atomically count a real use.
 */
export class PlatformPromoService {
  /** Compute the discount + final amount for a promo against a payable amount. */
  price(
    promo: { discountType: string; discountValue: number },
    amount: number,
  ): PromoPricing {
    let discount = 0;
    if (promo.discountType === "PERCENTAGE") {
      discount = round2((amount * promo.discountValue) / 100);
    } else {
      discount = promo.discountValue;
    }
    // Discount can never exceed the payable amount → final amount is never negative.
    if (discount > amount) discount = amount;
    if (discount < 0) discount = 0;
    const amountAfter = round2(amount - discount);
    return { amountBefore: round2(amount), discount: round2(discount), amountAfter };
  }

  /**
   * Validate a code for the given scope + context and return the promo + pricing.
   * Throws AppError(400, CODE) on any failure. Does NOT mutate usage.
   */
  async validateAndPrice(code: string, ctx: ValidateContext) {
    const now = ctx.now ?? new Date();
    // Codes are stored uppercase (admin create uppercases them); look up
    // case-insensitively so "plan_pro20" matches "PLAN_PRO20".
    const promo = await prisma.platformPromoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!promo) throw new AppError("رمز الخصم غير صحيح", 400, "PROMO_NOT_FOUND");
    // Scope separation — a COURSE_PURCHASE code can never be used on a teacher
    // plan checkout and vice versa.
    if (promo.scope !== ctx.scope) {
      throw new AppError("رمز الخصم غير صالح لهذه العملية", 400, "PROMO_SCOPE_MISMATCH");
    }
    if (!promo.isActive) throw new AppError("رمز الخصم غير مفعّل", 400, "PROMO_INACTIVE");
    if (promo.startsAt && now < promo.startsAt) {
      throw new AppError("رمز الخصم غير مفعّل بعد", 400, "PROMO_NOT_STARTED");
    }
    if (promo.expiresAt && now > promo.expiresAt) {
      throw new AppError("انتهت صلاحية رمز الخصم", 400, "PROMO_EXPIRED");
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw new AppError("تم استنفاد رمز الخصم", 400, "PROMO_LIMIT_REACHED");
    }
    if (promo.perUserLimit != null) {
      const used = await prisma.platformPromoRedemption.count({
        where: { promoCodeId: promo.id, userId: ctx.userId },
      });
      if (used >= promo.perUserLimit) {
        throw new AppError("لقد استخدمت هذا الرمز من قبل", 400, "PROMO_USER_LIMIT_REACHED");
      }
    }

    // TEACHER_PLAN-only restrictions.
    if (promo.scope === "TEACHER_PLAN") {
      if (promo.applicablePlanIds.length > 0 && ctx.planId && !promo.applicablePlanIds.includes(ctx.planId)) {
        throw new AppError("رمز الخصم لا ينطبق على هذه الباقة", 400, "PROMO_PLAN_NOT_ALLOWED");
      }
      if (
        promo.billingInterval !== "ALL" &&
        ctx.billingInterval &&
        promo.billingInterval !== ctx.billingInterval
      ) {
        throw new AppError("رمز الخصم لا ينطبق على فترة الفوترة هذه", 400, "PROMO_INTERVAL_NOT_ALLOWED");
      }
    }

    const pricing = this.price(promo, ctx.amount);
    return { promo, pricing };
  }

  /**
   * Atomically record a redemption and increment usedCount, re-checking maxUses
   * inside the transaction to avoid racing past the limit. Returns false if the
   * limit was hit concurrently.
   */
  async recordRedemption(
    tx: Prisma.TransactionClient | PrismaClient,
    promoId: string,
    userId: string,
    pricing: PromoPricing,
  ): Promise<boolean> {
    const current = await tx.platformPromoCode.findUniqueOrThrow({
      where: { id: promoId },
      select: { maxUses: true },
    });
    // Guard against racing past maxUses: only increment while still under the cap.
    const updated = await tx.platformPromoCode.updateMany({
      where: {
        id: promoId,
        ...(current.maxUses != null ? { usedCount: { lt: current.maxUses } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) return false;
    await tx.platformPromoRedemption.create({
      data: {
        promoCodeId: promoId,
        userId,
        amountBefore: pricing.amountBefore,
        discount: pricing.discount,
        amountAfter: pricing.amountAfter,
      },
    });
    return true;
  }
}

export const platformPromoService = new PlatformPromoService();
