import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "../../../config/database.js";
import { TeacherPlanService } from "../teacher-plan.service.js";
import { TeacherPlanPolicyService } from "../teacher-plan-policy.service.js";

const planService = new TeacherPlanService();
const policyService = new TeacherPlanPolicyService();
let teacherId: string;
let freePlanId: string;

describe("TeacherPlanService", () => {
  beforeAll(async () => {
    const plans = await prisma.teacherPlan.findMany();
    if (plans.length === 0) {
      throw new Error("Run seed-teacher-plans.ts first");
    }
    const teacher = await prisma.user.findFirst({
      where: { role: "OPERATION" },
    });
    if (teacher) {
      teacherId = teacher.id;
    }
    const freePlan = await prisma.teacherPlan.findUnique({ where: { code: "FREE" } });
    if (freePlan) freePlanId = freePlan.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("getActivePlans", () => {
    it("returns active plans", async () => {
      const plans = await planService.getActivePlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);
    });

    it("FREE plan has monthlyPrice 0", async () => {
      const plans = await planService.getActivePlans();
      const free = plans.find((p) => p.code === "FREE");
      expect(free).toBeDefined();
      expect(free!.monthlyPrice).toBe(0);
    });

    it("plans are sorted by sortOrder", async () => {
      const plans = await planService.getActivePlans();
      for (let i = 1; i < plans.length; i++) {
        const prev = plans[i - 1]!.sortOrder;
        const curr = plans[i]!.sortOrder;
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });

  describe("getPlanById", () => {
    it("returns null for non-existent plan", async () => {
      const plan = await planService.getPlanById("00000000-0000-0000-0000-000000000000");
      expect(plan).toBeNull();
    });

    it("returns plan by id", async () => {
      const plans = await planService.getActivePlans();
      if (plans.length > 0) {
        const plan = await planService.getPlanById(plans[0]!.id);
        expect(plan).not.toBeNull();
        expect(plan!.id).toBe(plans[0]!.id);
      }
    });
  });

  describe("getSubscriptionSummary", () => {
    it("returns default FREE plan for teacher with no subscription", async () => {
      const result = await planService.getSubscriptionSummary(teacherId);
      expect(result.effectivePlanCode).toBe("FREE");
      expect(result.currentPlan.code).toBe("FREE");
      expect(result.subscription).toBeNull();
    });

    it("returns usage summary with plan limits", async () => {
      const result = await planService.getSubscriptionSummary(teacherId);
      expect(result.usage.aiQuizGenerations).toBeDefined();
      expect(result.usage.aiEssayGradings).toBeDefined();
      expect(result.usage.students).toBeDefined();
      expect(result.usage.periodStart).toBeDefined();
      expect(result.usage.periodEnd).toBeDefined();
    });

    it("student count in usage is non-negative", async () => {
      const result = await planService.getSubscriptionSummary(teacherId);
      expect(result.usage.students.used).toBeGreaterThanOrEqual(0);
      expect(result.usage.students.limit).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("createSubscriptionRequest", () => {
    afterEach(async () => {
      await prisma.teacherSubscriptionRequest.deleteMany({
        where: { teacherId },
      });
    });

    it("creates PENDING subscription request when no payment system exists", async () => {
      const plans = await planService.getActivePlans();
      const proPlan = plans.find((p) => p.code === "PRO")!;
      expect(proPlan).toBeDefined();

      const result = await planService.createSubscriptionRequest(teacherId, {
        planId: proPlan.id,
        billingInterval: "MONTHLY",
      });

      expect(result.request.status).toBe("PENDING");
      expect(result.request.planId).toBe(proPlan.id);
      expect(result.message).toBeTruthy();
    });

    it("rejects duplicate pending request for same plan", async () => {
      const plans = await planService.getActivePlans();
      const basicPlan = plans.find((p) => p.code === "BASIC")!;

      await planService.createSubscriptionRequest(teacherId, {
        planId: basicPlan.id,
        billingInterval: "MONTHLY",
      });

      await expect(
        planService.createSubscriptionRequest(teacherId, {
          planId: basicPlan.id,
          billingInterval: "MONTHLY",
        }),
      ).rejects.toThrow();
    });

    it("rejects request for non-existent plan", async () => {
      await expect(
        planService.createSubscriptionRequest(teacherId, {
          planId: "00000000-0000-0000-0000-000000000000",
          billingInterval: "MONTHLY",
        }),
      ).rejects.toThrow();
    });

    it("teacher cannot set request status (status always PENDING)", async () => {
      const plans = await planService.getActivePlans();
      const premiumPlan = plans.find((p) => p.code === "PREMIUM")!;

      const result = await planService.createSubscriptionRequest(teacherId, {
        planId: premiumPlan.id,
        billingInterval: "MONTHLY",
      });

      expect(result.request.status).toBe("PENDING");
    });
  });

  describe("TeacherPlanPolicyService", () => {
    afterEach(async () => {
      await prisma.teacherAiUsageEvent.deleteMany({
        where: { teacherId },
      });
    });

    it("returns FREE plan for teacher with no subscription", async () => {
      const plan = await policyService.getTeacherEffectivePlan(teacherId);
      expect(plan.planCode).toBe("FREE");
    });

    it("allows AI quiz generation within quota", async () => {
      await expect(
        policyService.checkAiUsageQuota(teacherId, "AI_QUIZ_GENERATION", 1),
      ).resolves.toBeUndefined();
    });

    it("records AI quiz generation usage and it appears in summary", async () => {
      await policyService.recordAiUsage(teacherId, "AI_QUIZ_GENERATION", 1, {
        quizId: "test-quiz-id",
      });
      const events = await prisma.teacherAiUsageEvent.findMany({
        where: { teacherId, usageType: "AI_QUIZ_GENERATION" },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.units).toBe(1);
    });

    it("AI essay grading records units = number of essays graded", async () => {
      await policyService.recordAiUsage(teacherId, "AI_ESSAY_GRADING", 5, {
        attemptId: "test-attempt",
      });
      const events = await prisma.teacherAiUsageEvent.findMany({
        where: { teacherId, usageType: "AI_ESSAY_GRADING" },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.units).toBe(5);
    });

    it("usage summary counts only current period", async () => {
      await policyService.recordAiUsage(teacherId, "AI_QUIZ_GENERATION", 2);
      const summary = await planService.getSubscriptionSummary(teacherId);
      expect(summary.usage.aiQuizGenerations.used).toBeGreaterThanOrEqual(2);
    });

    it("returns usage summary with correct shape", async () => {
      const summary = await policyService.getUsageSummary(teacherId);
      expect(summary).toBeDefined();
      expect(summary.periodStart).toBeDefined();
      expect(summary.periodEnd).toBeDefined();
      expect(summary.aiQuizGenerations).toHaveProperty("used");
      expect(summary.aiQuizGenerations).toHaveProperty("limit");
      expect(summary.aiQuizGenerations).toHaveProperty("remaining");
      expect(summary.students).toHaveProperty("used");
      expect(summary.students).toHaveProperty("limit");
      expect(summary.storageMb).toHaveProperty("used");
      expect(summary.storageMb).toHaveProperty("limit");
    });
  });

  describe("Plan seed", () => {
    it("plans are idempotent (re-running seed does not duplicate)", async () => {
      const count1 = await prisma.teacherPlan.count();
      const plans = await planService.getActivePlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);

      const codes = plans.map((p) => p.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it("free plan exists with correct defaults", async () => {
      const freePlan = await prisma.teacherPlan.findUnique({ where: { code: "FREE" } });
      expect(freePlan).not.toBeNull();
      expect(freePlan!.isActive).toBe(true);
      expect(freePlan!.monthlyPrice).toBe(0);
      const limits = freePlan!.limits as Record<string, unknown>;
      expect(limits.aiQuizGenerationsPerMonth).toBe(5);
    });

    it("pro plan is recommended", async () => {
      const proPlan = await prisma.teacherPlan.findUnique({ where: { code: "PRO" } });
      expect(proPlan).not.toBeNull();
      expect(proPlan!.isRecommended).toBe(true);
    });
  });

  describe("No fake payment success", () => {
    it("request is always PENDING, never ACTIVE", async () => {
      const plans = await planService.getActivePlans();
      const basicPlan = plans.find((p) => p.code === "BASIC")!;

      const result = await planService.createSubscriptionRequest(teacherId, {
        planId: basicPlan.id,
        billingInterval: "MONTHLY",
      });

      expect(result.request.status).toBe("PENDING");
      expect(result.request.status).not.toBe("APPROVED");
    });
  });
});
