import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ListPlansQuery } from "./admin-plans.validation.js";
import type {
  AdminPlanListItem,
  AdminPlanDetailResponse,
  AdminPlansListResponse,
  AdminPlanTeacher,
  AdminPlanPayment,
  PlanStats,
  CreatePlanInput,
  UpdatePlanInput,
  StatusChangeInput,
  RecommendedChangeInput,
  ReorderInput,
  PlanMutationResponse,
} from "./admin-plans.types.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { AppError } from "../../shared/utils/AppError.js";

const FREE_PLAN_CODE = "FREE";

function emptyStats(): PlanStats {
  return {
    freeEntitlementsCount: 0,
    activePaidSubscriptionsCount: 0,
    pendingPaymentsCount: 0,
    successfulPaymentsCount: 0,
    confirmedRevenue: 0,
  };
}

function toMutationResponse(plan: {
  id: string;
  code: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  currency: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: Prisma.JsonValue;
  limits: Prisma.JsonValue;
}): PlanMutationResponse {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    displayName: plan.displayName,
    monthlyPrice: plan.monthlyPrice,
    currency: plan.currency,
    isActive: plan.isActive,
    isRecommended: plan.isRecommended,
    sortOrder: plan.sortOrder,
    features: (plan.features ?? {}) as Record<string, boolean>,
    limits: (plan.limits ?? {}) as Record<string, unknown>,
  };
}

export class AdminPlansService {
  async listPlans(query: ListPlansQuery): Promise<AdminPlansListResponse> {
    const { page, limit, q, isActive, sortBy, sort } = query;

    const where: Prisma.TeacherPlanWhereInput = {
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.TeacherPlanOrderByWithRelationInput = { [sortBy]: sort };

    const [total, plans] = await prisma.$transaction([
      prisma.teacherPlan.count({ where }),
      prisma.teacherPlan.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true,
          description: true,
          monthlyPrice: true,
          yearlyPrice: true,
          currency: true,
          isActive: true,
          isRecommended: true,
          sortOrder: true,
          features: true,
          limits: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const ids = plans.map((p) => p.id);

    if (ids.length === 0) {
      return { data: [], meta: { page, limit, total, totalPages } };
    }

    const statsById = await this.aggregatePlanStats(ids);

    const data: AdminPlanListItem[] = plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      currency: p.currency,
      isActive: p.isActive,
      isRecommended: p.isRecommended,
      sortOrder: p.sortOrder,
      features: (p.features ?? {}) as Record<string, boolean>,
      limits: p.limits as Record<string, unknown>,
      stats: statsById.get(p.id) ?? emptyStats(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return { data, meta: { page, limit, total, totalPages } };
  }

  async getPlanDetail(planId: string): Promise<AdminPlanDetailResponse | null> {
    const plan = await prisma.teacherPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        currency: true,
        isActive: true,
        isRecommended: true,
        sortOrder: true,
        features: true,
        limits: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!plan) return null;

    const statsMap = await this.aggregatePlanStats([plan.id]);
    const stats = statsMap.get(plan.id) ?? emptyStats();

    const activeSubscriptionsCount = await prisma.teacherSubscription.count({
      where: { planId: plan.id, status: { in: ["ACTIVE", "TRIALING"] } },
    });

    const teachers = await prisma.teacherSubscription.findMany({
      where: { planId: plan.id, status: { in: ["ACTIVE", "TRIALING"] } },
      select: {
        teacher: {
          select: { id: true, fullName: true, email: true, status: true },
        },
      },
      orderBy: { currentPeriodEnd: "desc" },
      take: 50,
    });

    const teachersList: AdminPlanTeacher[] = teachers.map((s) => ({
      id: s.teacher.id,
      fullName: s.teacher.fullName,
      email: s.teacher.email,
      status: s.teacher.status,
    }));

    const payments = await prisma.teacherSubscriptionPayment.findMany({
      where: { planId: plan.id },
      select: {
        id: true,
        teacherId: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        teacher: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const recentPayments: AdminPlanPayment[] = payments.map((p) => ({
      id: p.id,
      teacherId: p.teacherId,
      teacherName: p.teacher.fullName,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }));

    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      isActive: plan.isActive,
      isRecommended: plan.isRecommended,
      sortOrder: plan.sortOrder,
      features: (plan.features ?? {}) as Record<string, boolean>,
      limits: plan.limits as Record<string, unknown>,
      stats,
      activeSubscriptionsCount,
      teachers: teachersList,
      recentPayments,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private async aggregatePlanStats(ids: string[]): Promise<Map<string, PlanStats>> {
    const [activeSubs, pendingPayments, successPayments, freeTeachers] = await Promise.all([
      prisma.teacherSubscription.groupBy({
        by: ["planId"],
        where: { planId: { in: ids }, status: { in: ["ACTIVE", "TRIALING"] } },
        _count: { _all: true },
      }),
      prisma.teacherSubscriptionPayment.groupBy({
        by: ["planId"],
        where: { planId: { in: ids }, status: "PENDING" },
        _count: { _all: true },
      }),
      prisma.teacherSubscriptionPayment.groupBy({
        by: ["planId"],
        where: { planId: { in: ids }, status: "SUCCESS" },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.countFreeEntitlements(),
    ]);

    const activeMap = new Map(activeSubs.map((r) => [r.planId, r._count._all]));
    const pendingMap = new Map(pendingPayments.map((r) => [r.planId, r._count._all]));
    const successCountMap = new Map(successPayments.map((r) => [r.planId, r._count._all]));
    const revenueMap = new Map(
      successPayments.map((r) => [r.planId, Number(r._sum.amount ?? 0)]),
    );

    const plans = await prisma.teacherPlan.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true },
    });

    const freePlanId = plans.find((p) => p.code === FREE_PLAN_CODE)?.id;

    const out = new Map<string, PlanStats>();
    for (const id of ids) {
      const activeCount = activeMap.get(id) ?? 0;
      const isFree = id === freePlanId;
      out.set(id, {
        freeEntitlementsCount: isFree ? freeTeachers : 0,
        activePaidSubscriptionsCount: isFree ? 0 : activeCount,
        pendingPaymentsCount: pendingMap.get(id) ?? 0,
        successfulPaymentsCount: successCountMap.get(id) ?? 0,
        confirmedRevenue: isFree ? 0 : (revenueMap.get(id) ?? 0),
      });
    }
    return out;
  }

  private async countFreeEntitlements(): Promise<number> {
    const teachersWithPaidSub = await prisma.teacherSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING"] },
        plan: { code: { not: FREE_PLAN_CODE } },
      },
      select: { teacherId: true },
      distinct: ["teacherId"],
    });

    const paidTeacherIds = new Set(teachersWithPaidSub.map((s) => s.teacherId));

    const allActiveTeachers = await prisma.user.findMany({
      where: { role: "OPERATION", status: "ACTIVE" },
      select: { id: true },
    });

    let freeCount = 0;
    for (const t of allActiveTeachers) {
      if (!paidTeacherIds.has(t.id)) freeCount++;
    }
    return freeCount;
  }

  // ── Mutations ──

  async createPlan(input: CreatePlanInput, actorId: string): Promise<PlanMutationResponse> {
    const existing = await prisma.teacherPlan.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new AppError(`Plan with code '${input.code}' already exists`, 409, "PLAN_CODE_DUPLICATE");
    }

    if (input.code === FREE_PLAN_CODE && input.monthlyPrice !== 0) {
      throw new AppError("FREE plan must have monthlyPrice = 0", 400, "FREE_PLAN_MUST_BE_FREE");
    }

    const plan = await prisma.teacherPlan.create({
      data: {
        code: input.code,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        monthlyPrice: input.monthlyPrice,
        yearlyPrice: input.yearlyPrice ?? null,
        currency: input.currency ?? "EGP",
        billingInterval: "MONTHLY",
        isActive: input.isActive ?? true,
        isRecommended: input.isRecommended ?? false,
        sortOrder: input.sortOrder ?? 0,
        features: (input.features ?? {}) as Prisma.InputJsonValue,
        limits: (input.limits ?? {}) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        monthlyPrice: true,
        currency: true,
        isActive: true,
        isRecommended: true,
        sortOrder: true,
        features: true,
        limits: true,
      },
    });

    await auditLogService.record({
      action: "ADMIN_PLAN_CREATED",
      resourceType: "TeacherPlan",
      resourceId: plan.id,
      actorId,
      actorType: "ADMIN",
      details: { code: plan.code, name: plan.name },
    });

    return toMutationResponse(plan);
  }

  async updatePlan(planId: string, input: UpdatePlanInput, actorId: string): Promise<PlanMutationResponse> {
    const existing = await prisma.teacherPlan.findUnique({ where: { id: planId } });
    if (!existing) {
      throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    const data: Prisma.TeacherPlanUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isRecommended !== undefined) data.isRecommended = input.isRecommended;

    if (input.monthlyPrice !== undefined) {
      if (existing.code === FREE_PLAN_CODE && input.monthlyPrice !== 0) {
        throw new AppError("Cannot make FREE plan paid", 400, "FREE_PLAN_MUST_BE_FREE");
      }
      data.monthlyPrice = input.monthlyPrice;
    }

    if (input.yearlyPrice !== undefined) {
      data.yearlyPrice = input.yearlyPrice;
    }

    if (input.features !== undefined) {
      data.features = input.features as Prisma.InputJsonValue;
    }

    if (input.limits !== undefined) {
      data.limits = input.limits as Prisma.InputJsonValue;
    }

    const plan = await prisma.teacherPlan.update({
      where: { id: planId },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        monthlyPrice: true,
        currency: true,
        isActive: true,
        isRecommended: true,
        sortOrder: true,
        features: true,
        limits: true,
      },
    });

    await auditLogService.record({
      action: "ADMIN_PLAN_UPDATED",
      resourceType: "TeacherPlan",
      resourceId: plan.id,
      actorId,
      actorType: "ADMIN",
      details: { code: plan.code, updatedFields: Object.keys(data) },
    });

    return toMutationResponse(plan);
  }

  async changeStatus(
    planId: string,
    input: StatusChangeInput,
    actorId: string,
  ): Promise<PlanMutationResponse> {
    const existing = await prisma.teacherPlan.findUnique({ where: { id: planId } });
    if (!existing) {
      throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    if (!input.isActive) {
      if (existing.code === FREE_PLAN_CODE) {
        const otherActiveFree = await prisma.teacherPlan.findFirst({
          where: { code: { not: FREE_PLAN_CODE }, isActive: true, id: { not: planId } },
        });
        if (!otherActiveFree) {
          throw new AppError(
            "Cannot deactivate the only active FREE plan",
            400,
            "CANNOT_DEACTIVATE_ONLY_FREE",
          );
        }
      }

      const activeSubsCount = await prisma.teacherSubscription.count({
        where: { planId, status: { in: ["ACTIVE", "TRIALING"] } },
      });
      if (activeSubsCount > 0 && !input.reason) {
        throw new AppError(
          "Reason is required when deactivating a plan with active subscriptions",
          400,
          "REASON_REQUIRED",
        );
      }
    }

    const plan = await prisma.teacherPlan.update({
      where: { id: planId },
      data: { isActive: input.isActive },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        monthlyPrice: true,
        currency: true,
        isActive: true,
        isRecommended: true,
        sortOrder: true,
        features: true,
        limits: true,
      },
    });

    const action = input.isActive ? "ADMIN_PLAN_ACTIVATED" : "ADMIN_PLAN_DEACTIVATED";
    await auditLogService.record({
      action,
      resourceType: "TeacherPlan",
      resourceId: plan.id,
      actorId,
      actorType: "ADMIN",
      details: { code: plan.code, reason: input.reason ?? null },
    });

    return toMutationResponse(plan);
  }

  async changeRecommended(
    planId: string,
    input: RecommendedChangeInput,
    actorId: string,
  ): Promise<PlanMutationResponse> {
    const existing = await prisma.teacherPlan.findUnique({ where: { id: planId } });
    if (!existing) {
      throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    if (input.isRecommended) {
      await prisma.teacherPlan.updateMany({
        where: { isRecommended: true, id: { not: planId } },
        data: { isRecommended: false },
      });
    }

    const plan = await prisma.teacherPlan.update({
      where: { id: planId },
      data: { isRecommended: input.isRecommended },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        monthlyPrice: true,
        currency: true,
        isActive: true,
        isRecommended: true,
        sortOrder: true,
        features: true,
        limits: true,
      },
    });

    await auditLogService.record({
      action: "ADMIN_PLAN_RECOMMENDED_CHANGED",
      resourceType: "TeacherPlan",
      resourceId: plan.id,
      actorId,
      actorType: "ADMIN",
      details: { code: plan.code, isRecommended: plan.isRecommended },
    });

    return toMutationResponse(plan);
  }

  async reorder(input: ReorderInput, actorId: string): Promise<void> {
    const ids = input.items.map((i) => i.id);
    const existing = await prisma.teacherPlan.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((p) => p.id));

    for (const item of input.items) {
      if (!existingIds.has(item.id)) {
        throw new AppError(`Plan not found: ${item.id}`, 404, "PLAN_NOT_FOUND");
      }
    }

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.teacherPlan.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await auditLogService.record({
      action: "ADMIN_PLANS_REORDERED",
      resourceType: "TeacherPlan",
      resourceId: "bulk",
      actorId,
      actorType: "ADMIN",
      details: { items: input.items.map((i) => ({ id: i.id, sortOrder: i.sortOrder })) },
    });
  }
}

export const adminPlansService = new AdminPlansService();
