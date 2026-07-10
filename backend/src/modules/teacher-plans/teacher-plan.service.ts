import type { BillingInterval, SubscriptionStatus, SubscriptionRequestStatus, AiUsageType } from "../../generated/prisma/index.js";
import type { PlanPublicDTO, SubscriptionMeResponse, UsageSummaryDTO, PlanLimitDTO, CreateRequestInput, CreateRequestResponse } from "./teacher-plan.types.js";
import { DEFAULT_LIMITS } from "./teacher-plan.types.js";
import { getTeacherPlanMessage } from "./teacher-plan.i18n.js";
import { AppError } from "../../shared/utils/AppError.js";
import { prisma } from "../../config/database.js";
import { teacherSubscriptionPaymentService } from "./teacher-subscription-payment.service.js";

function isUnlimited(limit: number): boolean {
  return limit < 0;
}

function parseJsonField<T>(value: unknown): T {
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return value as T; }
  }
  return value as T;
}

function effectiveLimit(planLimits: Record<string, unknown>, key: string): number {
  const val = planLimits[key];
  if (val === undefined || val === null) {
    return (DEFAULT_LIMITS as Record<string, unknown>)[key] as number ?? 0;
  }
  return Number(val);
}

export class TeacherPlanService {

  async getActivePlans(locale: string = "ar"): Promise<PlanPublicDTO[]> {
    const plans = await prisma.teacherPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      displayName: p.displayName,
      description: p.description,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      currency: p.currency,
      isRecommended: p.isRecommended,
      sortOrder: p.sortOrder,
      features: parseJsonField<Record<string, boolean>>(p.features) ?? {},
      limits: parseJsonField<Record<string, unknown>>(p.limits) ?? {},
    }));
  }

  async getPlanById(planId: string): Promise<{
    id: string;
    code: string;
    displayName: string;
    monthlyPrice: number;
    yearlyPrice: number | null;
    isActive: boolean;
    limits: Record<string, unknown>;
    features: Record<string, boolean>;
  } | null> {
    const plan = await prisma.teacherPlan.findUnique({ where: { id: planId } });
    if (!plan) return null;
    return {
      id: plan.id,
      code: plan.code,
      displayName: plan.displayName,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      isActive: plan.isActive,
      limits: parseJsonField<Record<string, unknown>>(plan.limits) ?? {},
      features: parseJsonField<Record<string, boolean>>(plan.features) ?? {},
    };
  }

  async getPlanByCode(code: string): Promise<{
    id: string;
    code: string;
    displayName: string;
    monthlyPrice: number;
    yearlyPrice: number | null;
    isActive: boolean;
    limits: Record<string, unknown>;
    features: Record<string, boolean>;
  } | null> {
    const plan = await prisma.teacherPlan.findUnique({ where: { code } });
    if (!plan) return null;
    return {
      id: plan.id,
      code: plan.code,
      displayName: plan.displayName,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      isActive: plan.isActive,
      limits: parseJsonField<Record<string, unknown>>(plan.limits) ?? {},
      features: parseJsonField<Record<string, boolean>>(plan.features) ?? {},
    };
  }

  async getTeacherSubscription(teacherId: string) {
    return prisma.teacherSubscription.findFirst({
      where: {
        teacherId,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  async getTeacherPendingRequest(teacherId: string, planId?: string) {
    const where: Record<string, unknown> = {
      teacherId,
      status: "PENDING",
    };
    if (planId) where.planId = planId;
    return prisma.teacherSubscriptionRequest.findFirst({
      where: where as any,
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  async getSubscriptionSummary(teacherId: string, locale: string = "ar"): Promise<SubscriptionMeResponse> {
    const activeSub = await this.getTeacherSubscription(teacherId);
    const pendingReq = await this.getTeacherPendingRequest(teacherId);
    // "Paid" entitlement requires an ACTIVE, non-lapsed subscription — TRIALING /
    // PAST_DUE / expired do NOT grant a paid plan (they fall back to FREE).
    const isPaidActive =
      !!activeSub && activeSub.status === "ACTIVE" && activeSub.currentPeriodEnd > new Date();
    const effectivePlanCode = isPaidActive ? activeSub!.plan.code : "FREE";

    const effectivePlan = await this.getPlanByCode(effectivePlanCode);

    const usage = await this.computeUsageSummary(teacherId, effectivePlan?.limits ?? {});
    const pendingPayment = await teacherSubscriptionPaymentService.getPendingPayment(teacherId);

    if (isPaidActive && activeSub) {
      return {
        currentPlan: {
          id: activeSub.plan.id,
          code: activeSub.plan.code,
          displayName: activeSub.plan.displayName,
        },
        subscription: {
          id: activeSub.id,
          status: activeSub.status,
          billingInterval: activeSub.billingInterval,
          currentPeriodStart: activeSub.currentPeriodStart.toISOString(),
          currentPeriodEnd: activeSub.currentPeriodEnd.toISOString(),
          trialEndsAt: activeSub.trialEndsAt?.toISOString() ?? null,
        },
        usage,
        pendingRequest: pendingReq
          ? {
              id: pendingReq.id,
              planCode: pendingReq.plan.code,
              status: pendingReq.status,
              createdAt: pendingReq.createdAt.toISOString(),
            }
          : null,
        pendingPayment,
        effectivePlanCode,
        accessState: "PAID_PLAN",
        entitlementSource: "ACTIVE_SUBSCRIPTION",
        paymentRequired: false,
        upgradeAvailable: false,
      };
    }

    return {
      currentPlan: {
        id: effectivePlan?.id ?? "free-default",
        code: "FREE",
        displayName: "الباقة المجانية",
      },
      subscription: null,
      usage,
      pendingRequest: pendingReq
        ? {
            id: pendingReq.id,
            planCode: pendingReq.plan.code,
            status: pendingReq.status,
            createdAt: pendingReq.createdAt.toISOString(),
          }
        : null,
      pendingPayment,
      effectivePlanCode: "FREE",
      // Approved teacher without an active paid subscription → FREE plan, full
      // access, no payment required, upgrade offered. (This endpoint is only
      // reachable by an authenticated APPROVED+ACTIVE teacher.)
      accessState: "FREE_PLAN",
      entitlementSource: "DEFAULT_FREE_PLAN",
      paymentRequired: false,
      upgradeAvailable: true,
    };
  }

  async createSubscriptionRequest(
    teacherId: string,
    input: CreateRequestInput,
    locale: string = "ar",
  ): Promise<CreateRequestResponse> {
    const plan = await prisma.teacherPlan.findUnique({
      where: { id: input.planId },
    });

    if (!plan) {
      throw new AppError(getTeacherPlanMessage("PLAN_NOT_FOUND", locale), 404);
    }

    if (!plan.isActive) {
      throw new AppError(getTeacherPlanMessage("PLAN_INACTIVE", locale), 400);
    }

    const activeSub = await this.getTeacherSubscription(teacherId);
    if (activeSub && activeSub.planId === input.planId) {
      throw new AppError(getTeacherPlanMessage("ALREADY_ACTIVE", locale), 409);
    }

    const existingPending = await this.getTeacherPendingRequest(teacherId, input.planId);
    if (existingPending) {
      throw new AppError(getTeacherPlanMessage("REQUEST_DUPLICATE", locale), 409);
    }

    const request = await prisma.teacherSubscriptionRequest.create({
      data: {
        teacherId,
        planId: input.planId,
        requestedInterval: input.billingInterval ?? "MONTHLY",
        status: "PENDING",
      },
    });

    return {
      request: {
        id: request.id,
        status: request.status,
        planId: request.planId,
        createdAt: request.createdAt.toISOString(),
      },
      message: getTeacherPlanMessage("REQUEST_CREATED", locale),
    };
  }

  async getTeacherRequests(teacherId: string) {
    return prisma.teacherSubscriptionRequest.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  async computeUsageSummary(
    teacherId: string,
    planLimits: Record<string, unknown>,
  ): Promise<UsageSummaryDTO> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const usageEvents = await prisma.teacherAiUsageEvent.findMany({
      where: {
        teacherId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const quizGenUnits = usageEvents
      .filter((e) => e.usageType === "AI_QUIZ_GENERATION")
      .reduce((sum, e) => sum + e.units, 0);
    const essayGradingUnits = usageEvents
      .filter((e) => e.usageType === "AI_ESSAY_GRADING")
      .reduce((sum, e) => sum + e.units, 0);
    const contentGenUnits = usageEvents
      .filter((e) => e.usageType === "AI_CONTENT_GENERATION")
      .reduce((sum, e) => sum + e.units, 0);

    const quizLimit = effectiveLimit(planLimits, "aiQuizGenerationsPerMonth");
    const essayLimit = effectiveLimit(planLimits, "aiEssayGradingsPerMonth");
    const contentLimit = effectiveLimit(planLimits, "aiContentGenerationsPerMonth");
    const studentLimit = effectiveLimit(planLimits, "maxStudents");
    const storageMbLimit = effectiveLimit(planLimits, "storageMb");

    const studentCount = await this.countTeacherStudents(teacherId);
    const storageUsed = await this.computeStorageUsed(teacherId);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      aiQuizGenerations: this.limitDto(quizGenUnits, quizLimit),
      aiEssayGradings: this.limitDto(essayGradingUnits, essayLimit),
      aiContentGenerations: this.limitDto(contentGenUnits, contentLimit),
      students: { used: studentCount, limit: isUnlimited(studentLimit) ? -1 : studentLimit },
      storageMb: { used: Math.round(storageUsed), limit: isUnlimited(storageMbLimit) ? -1 : storageMbLimit },
    };
  }

  private limitDto(used: number, limit: number): PlanLimitDTO {
    if (isUnlimited(limit)) {
      return { used, limit: -1, remaining: -1 };
    }
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  async countTeacherStudents(teacherId: string): Promise<number> {
    const result = await prisma.enrollment.findMany({
      where: {
        chapter: { teacherId },
        status: "ACTIVE",
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    return result.length;
  }

  async computeStorageUsed(teacherId: string): Promise<number> {
    const result = await prisma.lessonMaterial.aggregate({
      where: {
        lesson: {
          chapter: { teacherId },
        },
        deletedAt: null,
      },
      _sum: { fileSize: true },
    });
    return (result._sum.fileSize ?? 0) / (1024 * 1024);
  }

  async countTeacherQuizzes(teacherId: string): Promise<number> {
    return prisma.quiz.count({
      where: { createdBy: teacherId },
    });
  }
}
