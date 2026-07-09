import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import type {
  AdminPaymentDTO,
  AdminSubscriptionDetail,
  AdminSubscriptionListItem,
  AdminSubscriptionRequestItem,
  AiUsageResponse,
  AiUsageRow,
  AiUsageTypeKey,
  ApproveSubscriptionRequestResponse,
  Paginated,
  PlanRef,
  RejectSubscriptionRequestResponse,
  TeacherEntitlementRow,
  TeacherRef,
} from "./admin-subscriptions.types.js";
import type {
  ApproveSubscriptionRequestInput,
  ListAiUsageQuery,
  ListEntitlementsQuery,
  ListPaymentsQuery,
  ListSubscriptionRequestsQuery,
  ListSubscriptionsQuery,
  RejectSubscriptionRequestInput,
} from "./admin-subscriptions.validation.js";

const AI_USAGE_TYPES: AiUsageTypeKey[] = [
  "AI_QUIZ_GENERATION",
  "AI_ESSAY_GRADING",
  "AI_CONTENT_GENERATION",
  "AI_LESSON_SUMMARY",
  "AI_QUESTION_EXPLANATION",
];

function emptyByType(): Record<AiUsageTypeKey, number> {
  return {
    AI_QUIZ_GENERATION: 0,
    AI_ESSAY_GRADING: 0,
    AI_CONTENT_GENERATION: 0,
    AI_LESSON_SUMMARY: 0,
    AI_QUESTION_EXPLANATION: 0,
  };
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function teacherRef(t: { id: string; fullName: string; email: string }): TeacherRef {
  return { id: t.id, fullName: t.fullName, email: t.email };
}

function planRef(p: { id: string; code: string; displayName: string }): PlanRef {
  return { id: p.id, code: p.code, displayName: p.displayName };
}

function teacherQuery(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  };
}

/**
 * Map a raw payment row to the safe admin DTO. This function is the single
 * place payments are serialised for the admin UI — it NEVER copies rawCallback,
 * checkoutUrl, providerOrderId/providerTransactionId, errorMessage, or any other
 * provider secret. Only the whitelisted fields below are ever returned.
 */
function toPaymentDTO(payment: {
  id: string;
  amount: number;
  currency: string;
  billingInterval: string;
  status: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
  teacher: { id: string; fullName: string; email: string };
  plan: { id: string; code: string; displayName: string };
}): AdminPaymentDTO {
  return {
    id: payment.id,
    teacher: teacherRef(payment.teacher),
    plan: planRef(payment.plan),
    amount: payment.amount,
    currency: payment.currency,
    billingInterval: payment.billingInterval,
    status: payment.status,
    provider: payment.provider,
    createdAt: payment.createdAt.toISOString(),
    // No dedicated paidAt column — approximate it with the SUCCESS timestamp.
    paidAt: payment.status === "SUCCESS" ? payment.updatedAt.toISOString() : null,
  };
}

const paymentSafeSelect = {
  id: true,
  amount: true,
  currency: true,
  billingInterval: true,
  status: true,
  provider: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, fullName: true, email: true } },
  plan: { select: { id: true, code: true, displayName: true } },
} as const;

/**
 * Admin Subscriptions Review read/review model. ADMIN-only.
 *
 * SAFE FIELDS ONLY: never returns rawCallback, checkoutUrl, provider order/txn
 * ids, or any Paymob secret. Revenue is counted strictly from SUCCESS
 * TeacherSubscriptionPayment rows — pending/failed payments never count and
 * never upgrade a plan. Approving a manual request does NOT fabricate a paid
 * subscription or a SUCCESS payment.
 */
export class AdminSubscriptionsService {
  // ── 1. Teacher entitlements ──────────────────────────────────────────────
  async listEntitlements(
    query: ListEntitlementsQuery,
  ): Promise<Paginated<TeacherEntitlementRow>> {
    const { page, limit, q, planCode, entitlementSource } = query;
    const now = new Date();

    const teachers = await prisma.user.findMany({
      where: {
        role: "OPERATION",
        teacherApprovalState: "APPROVED",
        status: "ACTIVE",
        ...(q ? teacherQuery(q) : {}),
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });

    if (teachers.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const ids = teachers.map((t) => t.id);

    const [activeSubs, pendingPayments, paymentGroups, freePlan] = await Promise.all([
      prisma.teacherSubscription.findMany({
        where: { teacherId: { in: ids }, status: "ACTIVE", currentPeriodEnd: { gt: now } },
        orderBy: { currentPeriodEnd: "desc" },
        include: { plan: { select: { id: true, code: true, displayName: true } } },
      }),
      prisma.teacherSubscriptionPayment.findMany({
        where: { teacherId: { in: ids }, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, teacherId: true, amount: true, currency: true,
          billingInterval: true, status: true, createdAt: true,
        },
      }),
      prisma.teacherSubscriptionPayment.groupBy({
        by: ["teacherId", "status"],
        where: { teacherId: { in: ids } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.teacherPlan.findUnique({
        where: { code: "FREE" },
        select: { id: true, code: true, displayName: true },
      }),
    ]);

    const activeByTeacher = new Map<string, (typeof activeSubs)[number]>();
    for (const s of activeSubs) if (!activeByTeacher.has(s.teacherId)) activeByTeacher.set(s.teacherId, s);

    const pendingByTeacher = new Map<string, (typeof pendingPayments)[number]>();
    for (const p of pendingPayments) if (!pendingByTeacher.has(p.teacherId)) pendingByTeacher.set(p.teacherId, p);

    const failedByTeacher = new Map<string, number>();
    const successCountByTeacher = new Map<string, number>();
    const successRevenueByTeacher = new Map<string, number>();
    for (const g of paymentGroups) {
      if (g.status === "FAILED") failedByTeacher.set(g.teacherId, g._count._all);
      if (g.status === "SUCCESS") {
        successCountByTeacher.set(g.teacherId, g._count._all);
        successRevenueByTeacher.set(g.teacherId, Number(g._sum.amount ?? 0));
      }
    }

    const freePlanRef: PlanRef = freePlan
      ? planRef(freePlan)
      : { id: "free-default", code: "FREE", displayName: "الباقة المجانية" };

    let rows: TeacherEntitlementRow[] = teachers.map((t) => {
      const active = activeByTeacher.get(t.id);
      const pending = pendingByTeacher.get(t.id);
      return {
        teacher: teacherRef(t),
        entitlementSource: active ? "ACTIVE_SUBSCRIPTION" : "DEFAULT_FREE_PLAN",
        currentPlan: active ? planRef(active.plan) : freePlanRef,
        activeSubscription: active
          ? {
              id: active.id,
              status: active.status,
              billingInterval: active.billingInterval,
              currentPeriodStart: active.currentPeriodStart.toISOString(),
              currentPeriodEnd: active.currentPeriodEnd.toISOString(),
              trialEndsAt: active.trialEndsAt?.toISOString() ?? null,
            }
          : null,
        pendingPayment: pending
          ? {
              id: pending.id,
              amount: pending.amount,
              currency: pending.currency,
              billingInterval: pending.billingInterval,
              status: pending.status,
              createdAt: pending.createdAt.toISOString(),
            }
          : null,
        failedPaymentsCount: failedByTeacher.get(t.id) ?? 0,
        successfulPaymentsCount: successCountByTeacher.get(t.id) ?? 0,
        confirmedSubscriptionRevenue: successRevenueByTeacher.get(t.id) ?? 0,
      };
    });

    // Derived filters (entitlementSource / planCode) applied after resolution.
    if (entitlementSource) rows = rows.filter((r) => r.entitlementSource === entitlementSource);
    if (planCode) rows = rows.filter((r) => r.currentPlan.code === planCode);

    const total = rows.length;
    const start = (page - 1) * limit;
    return {
      data: rows.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── 2. Paid subscriptions ─────────────────────────────────────────────────
  async listSubscriptions(
    query: ListSubscriptionsQuery,
  ): Promise<Paginated<AdminSubscriptionListItem>> {
    const { page, limit, q, status, planCode } = query;
    const where: Prisma.TeacherSubscriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(planCode ? { plan: { code: planCode } } : {}),
      ...(q ? { teacher: teacherQuery(q) } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.teacherSubscription.count({ where }),
      prisma.teacherSubscription.findMany({
        where,
        include: {
          teacher: { select: { id: true, fullName: true, email: true } },
          plan: { select: { id: true, code: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((s) => this.toSubscriptionItem(s)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private toSubscriptionItem(s: {
    id: string;
    status: string;
    billingInterval: string;
    startedAt: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt: Date | null;
    trialEndsAt: Date | null;
    createdAt: Date;
    teacher: { id: string; fullName: string; email: string };
    plan: { id: string; code: string; displayName: string };
  }): AdminSubscriptionListItem {
    return {
      id: s.id,
      teacher: teacherRef(s.teacher),
      plan: planRef(s.plan),
      status: s.status,
      billingInterval: s.billingInterval,
      startedAt: s.startedAt.toISOString(),
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async getSubscriptionDetail(subscriptionId: string): Promise<AdminSubscriptionDetail> {
    const sub = await prisma.teacherSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        plan: { select: { id: true, code: true, displayName: true } },
        payments: { orderBy: { createdAt: "desc" }, select: paymentSafeSelect },
      },
    });
    if (!sub) throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");

    const payments = sub.payments.map(toPaymentDTO);
    const successful = payments.filter((p) => p.status === "SUCCESS");

    return {
      ...this.toSubscriptionItem(sub),
      payments,
      successfulPaymentsCount: successful.length,
      failedPaymentsCount: payments.filter((p) => p.status === "FAILED").length,
      confirmedRevenue: successful.reduce((sum, p) => sum + p.amount, 0),
    };
  }

  // ── 3. Subscription payments ──────────────────────────────────────────────
  async listPayments(query: ListPaymentsQuery): Promise<Paginated<AdminPaymentDTO>> {
    const { page, limit, q, status, planCode } = query;
    const where: Prisma.TeacherSubscriptionPaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(planCode ? { plan: { code: planCode } } : {}),
      ...(q ? { teacher: teacherQuery(q) } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.teacherSubscriptionPayment.count({ where }),
      prisma.teacherSubscriptionPayment.findMany({
        where,
        select: paymentSafeSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toPaymentDTO),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPaymentDetail(paymentId: string): Promise<AdminPaymentDTO> {
    const payment = await prisma.teacherSubscriptionPayment.findUnique({
      where: { id: paymentId },
      select: paymentSafeSelect,
    });
    if (!payment) throw new AppError("Payment not found", 404, "PAYMENT_NOT_FOUND");
    return toPaymentDTO(payment);
  }

  // ── 4. Manual subscription requests ───────────────────────────────────────
  async listSubscriptionRequests(
    query: ListSubscriptionRequestsQuery,
  ): Promise<Paginated<AdminSubscriptionRequestItem>> {
    const { page, limit, q, status } = query;
    const where: Prisma.TeacherSubscriptionRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(q ? { teacher: teacherQuery(q) } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.teacherSubscriptionRequest.count({ where }),
      prisma.teacherSubscriptionRequest.findMany({
        where,
        include: {
          teacher: { select: { id: true, fullName: true, email: true } },
          plan: { select: { id: true, code: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((r) => this.toRequestItem(r)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private toRequestItem(r: {
    id: string;
    requestedInterval: string;
    status: string;
    adminNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    teacher: { id: string; fullName: string; email: string };
    plan: { id: string; code: string; displayName: string };
  }): AdminSubscriptionRequestItem {
    return {
      id: r.id,
      teacher: teacherRef(r.teacher),
      plan: planRef(r.plan),
      requestedInterval: r.requestedInterval,
      status: r.status,
      adminNotes: r.adminNotes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async loadRequest(requestId: string) {
    const request = await prisma.teacherSubscriptionRequest.findUnique({
      where: { id: requestId },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        plan: { select: { id: true, code: true, displayName: true } },
      },
    });
    if (!request) {
      throw new AppError("Subscription request not found", 404, "SUBSCRIPTION_REQUEST_NOT_FOUND");
    }
    return request;
  }

  /**
   * Approve a manual subscription request. Marks the request APPROVED and writes
   * an AuditLog, but does NOT fabricate a paid subscription or a SUCCESS payment
   * — a Paymob-verified webhook is the only path to an ACTIVE paid subscription.
   * Automated manual activation awaits a defined policy, hence the explicit
   * MANUAL_SUBSCRIPTION_ACTIVATION_POLICY_PENDING outcome.
   */
  async approveRequest(
    requestId: string,
    adminId: string,
    input: ApproveSubscriptionRequestInput,
  ): Promise<ApproveSubscriptionRequestResponse> {
    const request = await this.loadRequest(requestId);
    if (request.status !== "PENDING") {
      throw new AppError("Only a pending request can be approved", 409, "REQUEST_NOT_PENDING");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.teacherSubscriptionRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        },
        include: {
          teacher: { select: { id: true, fullName: true, email: true } },
          plan: { select: { id: true, code: true, displayName: true } },
        },
      });

      await auditLogService.record(
        {
          action: "TEACHER_SUBSCRIPTION_REQUEST_APPROVED",
          resourceType: "TeacherSubscriptionRequest",
          resourceId: requestId,
          actorId: adminId,
          actorType: "ADMIN",
          details: {
            planCode: req.plan.code,
            requestedInterval: req.requestedInterval,
            // No subscription/payment was fabricated on approval.
            activation: "MANUAL_SUBSCRIPTION_ACTIVATION_POLICY_PENDING",
          },
        },
        tx,
      );

      return req;
    });

    return {
      request: this.toRequestItem(updated),
      activation: "MANUAL_SUBSCRIPTION_ACTIVATION_POLICY_PENDING",
    };
  }

  /** Reject a manual subscription request (REJECTED + AuditLog; never deleted). */
  async rejectRequest(
    requestId: string,
    adminId: string,
    input: RejectSubscriptionRequestInput,
  ): Promise<RejectSubscriptionRequestResponse> {
    const request = await this.loadRequest(requestId);
    if (request.status !== "PENDING") {
      throw new AppError("Only a pending request can be rejected", 409, "REQUEST_NOT_PENDING");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.teacherSubscriptionRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", adminNotes: input.adminNotes },
        include: {
          teacher: { select: { id: true, fullName: true, email: true } },
          plan: { select: { id: true, code: true, displayName: true } },
        },
      });

      await auditLogService.record(
        {
          action: "TEACHER_SUBSCRIPTION_REQUEST_REJECTED",
          resourceType: "TeacherSubscriptionRequest",
          resourceId: requestId,
          actorId: adminId,
          actorType: "ADMIN",
          details: { planCode: req.plan.code },
        },
        tx,
      );

      return req;
    });

    return { request: this.toRequestItem(updated) };
  }

  // ── 5. AI usage overview ──────────────────────────────────────────────────
  async listAiUsage(query: ListAiUsageQuery): Promise<AiUsageResponse> {
    const { page, limit, q, usageType } = query;

    // Resolve candidate teachers (optionally filtered by q).
    const teachers = await prisma.user.findMany({
      where: { role: "OPERATION", ...(q ? teacherQuery(q) : {}) },
      select: { id: true, fullName: true, email: true },
    });
    const teacherById = new Map(teachers.map((t) => [t.id, t]));
    const teacherIds = teachers.map((t) => t.id);

    const emptyTotals = { totalEvents: 0, totalUnits: 0, byType: emptyByType() };
    if (teacherIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 }, totals: emptyTotals };
    }

    const monthStart = startOfCurrentMonthUtc();
    const usageFilter = usageType ? { usageType } : {};

    const [byTypeGroups, monthGroups] = await Promise.all([
      prisma.teacherAiUsageEvent.groupBy({
        by: ["teacherId", "usageType"],
        where: { teacherId: { in: teacherIds }, ...usageFilter },
        _sum: { units: true },
        _count: { _all: true },
      }),
      prisma.teacherAiUsageEvent.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds }, createdAt: { gte: monthStart }, ...usageFilter },
        _sum: { units: true },
      }),
    ]);

    const monthByTeacher = new Map<string, number>();
    for (const g of monthGroups) monthByTeacher.set(g.teacherId, Number(g._sum.units ?? 0));

    const rowByTeacher = new Map<string, AiUsageRow>();
    const totals = { totalEvents: 0, totalUnits: 0, byType: emptyByType() };

    for (const g of byTypeGroups) {
      const teacher = teacherById.get(g.teacherId);
      if (!teacher) continue;
      const units = Number(g._sum.units ?? 0);
      const events = g._count._all;
      const type = g.usageType as AiUsageTypeKey;

      let row = rowByTeacher.get(g.teacherId);
      if (!row) {
        row = {
          teacher: teacherRef(teacher),
          totalEvents: 0,
          totalUnits: 0,
          currentMonthUnits: monthByTeacher.get(g.teacherId) ?? 0,
          byType: emptyByType(),
        };
        rowByTeacher.set(g.teacherId, row);
      }
      row.totalEvents += events;
      row.totalUnits += units;
      if (AI_USAGE_TYPES.includes(type)) row.byType[type] += units;

      totals.totalEvents += events;
      totals.totalUnits += units;
      if (AI_USAGE_TYPES.includes(type)) totals.byType[type] += units;
    }

    // Only teachers with usage; most active first.
    const allRows = [...rowByTeacher.values()].sort((a, b) => b.totalUnits - a.totalUnits);
    const total = allRows.length;
    const start = (page - 1) * limit;

    return {
      data: allRows.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      totals,
    };
  }
}

export const adminSubscriptionsService = new AdminSubscriptionsService();
