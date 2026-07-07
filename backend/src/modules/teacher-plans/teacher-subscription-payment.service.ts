import type { BillingInterval } from "../../generated/prisma/index.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { PaymobService } from "../payment/paymob.service.js";
import type { BillingData } from "../payment/paymob.service.js";
import { getTeacherPlanMessage } from "./teacher-plan.i18n.js";

export interface CheckoutInput {
  planId: string;
  billingInterval: BillingInterval;
}

export interface CheckoutResult {
  paymentId: string;
  orderId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  status: "PENDING";
}

export interface PendingPaymentDTO {
  id: string;
  planId: string;
  planCode: string;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  createdAt: string;
}

function addInterval(start: Date, interval: BillingInterval): Date {
  const end = new Date(start);
  if (interval === "YEARLY") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

/**
 * Handles the paid teacher-plan subscription flow through Paymob.
 *
 * Invariants (enforced here, never trusted from the client):
 *  - price/currency/interval come from the DB plan, not the request body.
 *  - checkout creates a PENDING TeacherSubscriptionPayment only; it NEVER
 *    creates or activates a TeacherSubscription.
 *  - a subscription becomes ACTIVE only inside handleProviderWebhook after the
 *    HMAC-verified provider callback reports success.
 *  - a failed callback marks the payment FAILED and activates nothing.
 */
export class TeacherSubscriptionPaymentService {
  constructor(private readonly paymob: PaymobService = new PaymobService()) {}

  async createCheckout(
    teacherId: string,
    input: CheckoutInput,
    locale: string = "ar",
  ): Promise<CheckoutResult> {
    const plan = await prisma.teacherPlan.findUnique({
      where: { id: input.planId },
    });

    if (!plan) {
      throw new AppError(getTeacherPlanMessage("PLAN_NOT_FOUND", locale), 404);
    }
    if (!plan.isActive) {
      throw new AppError(getTeacherPlanMessage("PLAN_INACTIVE", locale), 400);
    }

    // Price is resolved strictly from the DB plan — the request body never
    // carries a price.
    let amount: number | null;
    if (input.billingInterval === "YEARLY") {
      amount = plan.yearlyPrice;
      if (amount === null || amount === undefined) {
        throw new AppError(
          getTeacherPlanMessage("YEARLY_NOT_AVAILABLE", locale),
          400,
        );
      }
    } else {
      amount = plan.monthlyPrice;
    }

    if (amount === null || amount <= 0) {
      throw new AppError(
        getTeacherPlanMessage("PLAN_FREE_NO_PAYMENT", locale),
        400,
      );
    }

    // Already on this exact plan (active) — nothing to pay for.
    const activeSub = await prisma.teacherSubscription.findFirst({
      where: {
        teacherId,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
        planId: input.planId,
      },
    });
    if (activeSub) {
      throw new AppError(getTeacherPlanMessage("ALREADY_ACTIVE", locale), 409);
    }

    // Avoid spawning duplicate provider orders for the same plan.
    const existingPending = await prisma.teacherSubscriptionPayment.findFirst({
      where: { teacherId, planId: input.planId, status: "PENDING" },
    });
    if (existingPending && existingPending.checkoutUrl) {
      throw new AppError(
        getTeacherPlanMessage("PAYMENT_PENDING_EXISTS", locale),
        409,
      );
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true, email: true, mobile: true },
    });
    if (!teacher) {
      throw new AppError(getTeacherPlanMessage("NOT_FOUND", locale), 404);
    }

    const nameParts = teacher.fullName.split(" ");
    const billingData: BillingData = {
      first_name: nameParts[0] ?? "NA",
      last_name: nameParts.slice(1).join(" ") || "NA",
      email: teacher.email,
      phone_number: teacher.mobile.startsWith("+2")
        ? teacher.mobile
        : `+2${teacher.mobile}`,
      apartment: "NA",
      floor: "NA",
      street: "NA",
      building: "NA",
      city: "NA",
      country: "NA",
      state: "NA",
      postal_code: "NA",
    };

    let orderId: string;
    let checkoutUrl: string;
    try {
      const token = await this.paymob.getValidToken();
      orderId = await this.paymob.createOrder(token, amount);
      const redirectionUrl = `${env.FRONTEND_BASE_URL}/teacher/plans?orderId=${orderId}`;
      const paymentKey = await this.paymob.getPaymentKey(
        token,
        orderId,
        amount,
        billingData,
        undefined,
        redirectionUrl,
      );
      checkoutUrl = this.paymob.buildIframeUrl(paymentKey);
    } catch (err) {
      logger.error("Teacher subscription checkout — provider error", {
        teacherId,
        planId: input.planId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError(
        getTeacherPlanMessage("PAYMENT_PROVIDER_UNAVAILABLE", locale),
        502,
        "PAYMENT_PROVIDER_UNAVAILABLE",
      );
    }

    const payment = await prisma.teacherSubscriptionPayment.create({
      data: {
        teacherId,
        planId: input.planId,
        provider: "PAYMOB",
        providerOrderId: orderId,
        amount,
        currency: plan.currency,
        billingInterval: input.billingInterval,
        status: "PENDING",
        checkoutUrl,
      },
    });

    return {
      paymentId: payment.id,
      orderId,
      checkoutUrl,
      amount,
      currency: plan.currency,
      billingInterval: input.billingInterval,
      status: "PENDING",
    };
  }

  /**
   * Resolve a verified Paymob webhook against a teacher subscription payment.
   * Returns true if the order belonged to a teacher payment (handled), false
   * if it did not (so the caller can try other payment types). MUST only be
   * called after the caller has verified the provider HMAC signature.
   */
  async handleProviderWebhook(
    providerOrderId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const payment = await prisma.teacherSubscriptionPayment.findUnique({
      where: { providerOrderId },
    });

    if (!payment) return false;

    if (payment.status !== "PENDING") {
      logger.info("Teacher subscription webhook skipped — already processed", {
        providerOrderId,
        status: payment.status,
      });
      return true;
    }

    if (payload.success === true) {
      const now = new Date();
      const periodEnd = addInterval(now, payment.billingInterval);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.teacherSubscription.findFirst({
          where: {
            teacherId: payment.teacherId,
            status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
          },
          orderBy: { createdAt: "desc" },
        });

        let subscriptionId: string;
        if (existing) {
          const updated = await tx.teacherSubscription.update({
            where: { id: existing.id },
            data: {
              planId: payment.planId,
              status: "ACTIVE",
              billingInterval: payment.billingInterval,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              cancelledAt: null,
            },
          });
          subscriptionId = updated.id;
        } else {
          const created = await tx.teacherSubscription.create({
            data: {
              teacherId: payment.teacherId,
              planId: payment.planId,
              status: "ACTIVE",
              billingInterval: payment.billingInterval,
              startedAt: now,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          });
          subscriptionId = created.id;
        }

        await tx.teacherSubscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            providerTransactionId: String(payload.id),
            subscriptionId,
            rawCallback: payload as unknown as Prisma.InputJsonValue,
          },
        });
      });

      logger.info("Teacher subscription payment succeeded — activated", {
        providerOrderId,
        paymentId: payment.id,
        teacherId: payment.teacherId,
      });

      await auditLogService.record({
        action: "PAYMENT_COMPLETED",
        resourceType: "TEACHER_SUBSCRIPTION_PAYMENT",
        resourceId: payment.id,
        actorId: payment.teacherId,
        actorType: "SYSTEM",
        scopeTeacherId: payment.teacherId,
        details: {
          planId: payment.planId,
          amount: payment.amount,
          billingInterval: payment.billingInterval,
        },
      });

      return true;
    }

    const errorMessage =
      ((payload.data as Record<string, unknown> | undefined)
        ?.message as string) ?? "Payment failed";

    await prisma.teacherSubscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        errorMessage,
        rawCallback: payload as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info("Teacher subscription payment failed", {
      providerOrderId,
      paymentId: payment.id,
      error: errorMessage,
    });

    await auditLogService.record({
      action: "PAYMENT_FAILED",
      resourceType: "TEACHER_SUBSCRIPTION_PAYMENT",
      resourceId: payment.id,
      actorId: payment.teacherId,
      actorType: "SYSTEM",
      scopeTeacherId: payment.teacherId,
      details: {
        planId: payment.planId,
        amount: payment.amount,
        error: errorMessage,
      },
    });

    return true;
  }

  /**
   * Latest pending payment for a teacher, surfaced on the subscription summary.
   * Never includes rawCallback / provider secrets.
   */
  async getPendingPayment(teacherId: string): Promise<PendingPaymentDTO | null> {
    const payment = await prisma.teacherSubscriptionPayment.findFirst({
      where: { teacherId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { code: true } } },
    });
    if (!payment) return null;
    return {
      id: payment.id,
      planId: payment.planId,
      planCode: payment.plan.code,
      billingInterval: payment.billingInterval,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      checkoutUrl: payment.checkoutUrl,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}

export const teacherSubscriptionPaymentService =
  new TeacherSubscriptionPaymentService();
