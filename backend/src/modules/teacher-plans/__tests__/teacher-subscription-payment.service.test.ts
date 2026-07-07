import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../config/database.js";
import { TeacherSubscriptionPaymentService } from "../teacher-subscription-payment.service.js";
import { TeacherPlanPolicyService } from "../teacher-plan-policy.service.js";
import { TEACHER_PLANS } from "../teacher-plan.seed-data.js";
import type { PaymobService } from "../../payment/paymob.service.js";

/**
 * Fake Paymob provider — never touches the network. Records the amount passed
 * to createOrder so tests can prove the price comes from the DB plan, not the
 * request.
 */
class FakePaymob {
  public lastOrderAmount: number | undefined;
  public lastRedirect: string | undefined;
  async getValidToken(): Promise<string> {
    return "fake-token";
  }
  async createOrder(_token: string, amount: number): Promise<string> {
    this.lastOrderAmount = amount;
    return `fake-order-${randomUUID()}`;
  }
  async getPaymentKey(
    _token: string,
    _orderId: string,
    _amount: number,
    _billing: unknown,
    _chapterId?: string,
    redirect?: string,
  ): Promise<string> {
    this.lastRedirect = redirect;
    return "fake-payment-key";
  }
  buildIframeUrl(key: string): string {
    return `https://pay.test/iframe/${key}`;
  }
}

const policyService = new TeacherPlanPolicyService();

let teacherId: string;
let basicPlanId: string;

async function upsertPlans() {
  for (const plan of TEACHER_PLANS) {
    await prisma.teacherPlan.upsert({
      where: { code: plan.code },
      update: { monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, isActive: plan.isActive },
      create: {
        code: plan.code,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
    });
  }
}

function makeService() {
  const fake = new FakePaymob();
  const service = new TeacherSubscriptionPaymentService(
    fake as unknown as PaymobService,
  );
  return { fake, service };
}

describe("TeacherSubscriptionPaymentService — paid checkout flow", () => {
  beforeAll(async () => {
    await upsertPlans();
    const basic = await prisma.teacherPlan.findUniqueOrThrow({ where: { code: "BASIC" } });
    basicPlanId = basic.id;
    const teacher = await prisma.user.create({
      data: {
        email: `tsp-${randomUUID()}@test.local`,
        fullName: "Checkout Test Teacher",
        mobile: `018${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
        password: "not-used",
        role: "OPERATION",
        status: "ACTIVE",
      },
    });
    teacherId = teacher.id;
  });

  afterAll(async () => {
    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
    await prisma.teacherSubscription.deleteMany({ where: { teacherId } });
    await prisma.teacherAiUsageEvent.deleteMany({ where: { teacherId } });
    await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejects checkout for a non-existent plan", async () => {
    const { service } = makeService();
    await expect(
      service.createCheckout(teacherId, {
        planId: "00000000-0000-0000-0000-000000000000",
        billingInterval: "MONTHLY",
      }),
    ).rejects.toThrow();
  });

  it("uses the backend DB price only (never a client-supplied price)", async () => {
    const { fake, service } = makeService();
    const result = await service.createCheckout(teacherId, {
      planId: basicPlanId,
      billingInterval: "MONTHLY",
    });
    // BASIC monthlyPrice is 199 in the DB catalog.
    expect(fake.lastOrderAmount).toBe(199);
    expect(result.amount).toBe(199);
    expect(result.checkoutUrl).toContain("https://pay.test/iframe/");
    // Redirect points back to the teacher plans page, not the student area.
    expect(fake.lastRedirect).toContain("/teacher/plans");

    // Cleanup this pending payment so later checkouts are not blocked.
    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
  });

  it("does NOT activate a subscription at checkout (stays pending)", async () => {
    const { service } = makeService();
    const result = await service.createCheckout(teacherId, {
      planId: basicPlanId,
      billingInterval: "MONTHLY",
    });

    const payment = await prisma.teacherSubscriptionPayment.findUniqueOrThrow({
      where: { id: result.paymentId },
    });
    expect(payment.status).toBe("PENDING");

    const sub = await prisma.teacherSubscription.findFirst({ where: { teacherId } });
    expect(sub).toBeNull();

    // Effective plan is still FREE until payment is confirmed.
    const plan = await policyService.getTeacherEffectivePlan(teacherId);
    expect(plan.planCode).toBe("FREE");

    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
  });

  it("activates the subscription only after a verified successful callback", async () => {
    const { service } = makeService();
    const result = await service.createCheckout(teacherId, {
      planId: basicPlanId,
      billingInterval: "MONTHLY",
    });

    const handled = await service.handleProviderWebhook(result.orderId, {
      success: true,
      id: 999001,
    });
    expect(handled).toBe(true);

    const payment = await prisma.teacherSubscriptionPayment.findUniqueOrThrow({
      where: { id: result.paymentId },
    });
    expect(payment.status).toBe("SUCCESS");
    expect(payment.subscriptionId).not.toBeNull();

    const sub = await prisma.teacherSubscription.findFirstOrThrow({ where: { teacherId } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.planId).toBe(basicPlanId);

    // AI quota now reads the paid (BASIC) plan.
    const plan = await policyService.getTeacherEffectivePlan(teacherId);
    expect(plan.planCode).toBe("BASIC");

    // Reset for the next test.
    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
    await prisma.teacherSubscription.deleteMany({ where: { teacherId } });
  });

  it("does NOT activate anything on a failed callback", async () => {
    const { service } = makeService();
    const result = await service.createCheckout(teacherId, {
      planId: basicPlanId,
      billingInterval: "MONTHLY",
    });

    const handled = await service.handleProviderWebhook(result.orderId, {
      success: false,
      id: 999002,
      data: { message: "declined" },
    });
    expect(handled).toBe(true);

    const payment = await prisma.teacherSubscriptionPayment.findUniqueOrThrow({
      where: { id: result.paymentId },
    });
    expect(payment.status).toBe("FAILED");
    expect(payment.subscriptionId).toBeNull();

    const sub = await prisma.teacherSubscription.findFirst({
      where: { teacherId, status: "ACTIVE" },
    });
    expect(sub).toBeNull();

    const plan = await policyService.getTeacherEffectivePlan(teacherId);
    expect(plan.planCode).toBe("FREE");

    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
  });

  it("returns false for an unknown provider order (not a teacher payment)", async () => {
    const { service } = makeService();
    const handled = await service.handleProviderWebhook("no-such-order", {
      success: true,
      id: 1,
    });
    expect(handled).toBe(false);
  });

  it("never exposes rawCallback in the checkout result or pending payment DTO", async () => {
    const { service } = makeService();
    const result = await service.createCheckout(teacherId, {
      planId: basicPlanId,
      billingInterval: "MONTHLY",
    });
    expect(result).not.toHaveProperty("rawCallback");

    const pending = await service.getPendingPayment(teacherId);
    expect(pending).not.toBeNull();
    expect(pending).not.toHaveProperty("rawCallback");
    expect(pending!.status).toBe("PENDING");

    await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
  });
});
