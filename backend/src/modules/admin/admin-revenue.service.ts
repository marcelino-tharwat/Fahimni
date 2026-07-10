import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { adminSubscriptionsService } from "./admin-subscriptions.service.js";
import type { AdminPaymentDTO } from "./admin-subscriptions.types.js";
import type {
  CoursePaymentDTO,
  Paginated,
  RevenueByChapterRow,
  RevenueByTeacherRow,
  RevenueSummary,
} from "./admin-revenue.types.js";
import type {
  ListCoursePaymentsQuery,
  ListSubscriptionPaymentsQuery,
  RevenueRankingQuery,
} from "./admin-revenue.validation.js";

const CURRENCY = "EGP";

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function paginate<T>(rows: T[], page: number, limit: number): Paginated<T> {
  const total = rows.length;
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Subscription-payment safe select (mirrors the subscriptions module). */
const subPaymentSafeSelect = {
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
 * Admin Revenue & Payments read model. ADMIN-only.
 *
 * REVENUE POLICY: confirmed revenue counts ONLY SUCCESS rows —
 * course revenue from PaymentTransaction.status=SUCCESS, subscription revenue
 * from TeacherSubscriptionPayment.status=SUCCESS. FREE plans generate zero
 * revenue and are counted separately; PENDING/FAILED appear only in the
 * pending/failed metrics. SAFE FIELDS ONLY — never rawCallback, provider order/
 * txn ids, errorMessage, checkoutUrl, or any Paymob secret.
 */
export class AdminRevenueService {
  async getSummary(): Promise<RevenueSummary> {
    const monthStart = startOfCurrentMonthUtc();
    const now = new Date();

    const [
      courseRev,
      monthlyCourseRev,
      subRev,
      monthlySubRev,
      pendingCoursePayments,
      failedCoursePayments,
      pendingSubscriptionPayments,
      failedSubscriptionPayments,
      approvedActiveTeachers,
      activePaidSubs,
    ] = await Promise.all([
      prisma.paymentTransaction.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.teacherSubscriptionPayment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.teacherSubscriptionPayment.aggregate({
        where: { status: "SUCCESS", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.paymentTransaction.count({ where: { status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { status: "FAILED" } }),
      prisma.teacherSubscriptionPayment.count({ where: { status: "PENDING" } }),
      prisma.teacherSubscriptionPayment.count({ where: { status: "FAILED" } }),
      prisma.user.count({ where: { role: "OPERATION", teacherApprovalState: "APPROVED", status: "ACTIVE" } }),
      prisma.teacherSubscription.findMany({
        where: {
          status: "ACTIVE",
          currentPeriodEnd: { gt: now },
          teacher: { role: "OPERATION", teacherApprovalState: "APPROVED", status: "ACTIVE" },
        },
        select: { teacherId: true },
        distinct: ["teacherId"],
      }),
    ]);

    const confirmedCourseRevenue = Number(courseRev._sum.amount ?? 0);
    const confirmedTeacherSubscriptionRevenue = Number(subRev._sum.amount ?? 0);
    const paidTeachersCount = activePaidSubs.length;
    const freeTeachersCount = Math.max(0, approvedActiveTeachers - paidTeachersCount);

    const reliabilityWarnings = [
      "إيرادات الكورسات المؤكدة تحتسب فقط مدفوعات Paymob الناجحة؛ الاشتراكات المجانية أو عبر الأكواد غير محتسبة.",
      "إيراد اشتراكات المدرسين يحتسب فقط مدفوعات الاشتراك الناجحة؛ الباقة المجانية لا تولّد أي إيراد.",
      "المدفوعات المعلقة والفاشلة غير محتسبة في الإيرادات وتظهر في مقاييس المعلق/الفاشل فقط.",
      "المبالغ المستردة والإلغاءات غير محتسبة في الإيرادات.",
    ];

    return {
      confirmedCourseRevenue,
      confirmedTeacherSubscriptionRevenue,
      totalConfirmedRevenue: confirmedCourseRevenue + confirmedTeacherSubscriptionRevenue,
      monthlyConfirmedRevenue:
        Number(monthlyCourseRev._sum.amount ?? 0) + Number(monthlySubRev._sum.amount ?? 0),
      freeTeachersCount,
      paidTeachersCount,
      pendingCoursePayments,
      failedCoursePayments,
      pendingSubscriptionPayments,
      failedSubscriptionPayments,
      currency: CURRENCY,
      reliabilityWarnings,
    };
  }

  async getRevenueByTeacher(query: RevenueRankingQuery): Promise<Paginated<RevenueByTeacherRow>> {
    const { page, limit } = query;

    // Course revenue attributed via chapter.teacherId (SUCCESS only).
    const courseRows = await prisma.$queryRaw<
      { teacherId: string; revenue: number | null; cnt: bigint | number }[]
    >`
      SELECT c."teacherId" AS "teacherId", SUM(pt.amount) AS revenue, COUNT(*) AS cnt
      FROM payment_transactions pt
      JOIN chapters c ON c.id = pt."chapterId"
      WHERE pt.status = 'SUCCESS'
      GROUP BY c."teacherId"
    `;

    // Platform revenue the teacher paid for their plan (SUCCESS subscription payments).
    const subRows = await prisma.teacherSubscriptionPayment.groupBy({
      by: ["teacherId"],
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    });

    const map = new Map<string, RevenueByTeacherRow>();
    const ensure = (teacherId: string): RevenueByTeacherRow => {
      let row = map.get(teacherId);
      if (!row) {
        row = {
          teacher: { id: teacherId, fullName: "—" },
          courseRevenue: 0,
          subscriptionRevenue: 0,
          successfulCoursePayments: 0,
        };
        map.set(teacherId, row);
      }
      return row;
    };
    for (const r of courseRows) {
      const row = ensure(r.teacherId);
      row.courseRevenue = Number(r.revenue ?? 0);
      row.successfulCoursePayments = Number(r.cnt ?? 0);
    }
    for (const r of subRows) {
      ensure(r.teacherId).subscriptionRevenue = Number(r._sum.amount ?? 0);
    }

    const ids = [...map.keys()];
    if (ids.length > 0) {
      const teachers = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true },
      });
      for (const t of teachers) {
        const row = map.get(t.id);
        if (row) row.teacher.fullName = t.fullName;
      }
    }

    const rows = [...map.values()].sort(
      (a, b) => b.courseRevenue - a.courseRevenue || b.subscriptionRevenue - a.subscriptionRevenue,
    );
    return paginate(rows, page, limit);
  }

  async getRevenueByChapter(query: RevenueRankingQuery): Promise<Paginated<RevenueByChapterRow>> {
    const { page, limit } = query;
    const rows = await prisma.$queryRaw<
      { chapterId: string; chapterName: string; teacherId: string; revenue: number | null; cnt: bigint | number }[]
    >`
      SELECT c.id AS "chapterId", c.name AS "chapterName", c."teacherId" AS "teacherId",
             SUM(pt.amount) AS revenue, COUNT(*) AS cnt
      FROM payment_transactions pt
      JOIN chapters c ON c.id = pt."chapterId"
      WHERE pt.status = 'SUCCESS'
      GROUP BY c.id, c.name, c."teacherId"
      ORDER BY revenue DESC
    `;

    const teacherIds = [...new Set(rows.map((r) => r.teacherId))];
    const nameById = new Map<string, string>();
    if (teacherIds.length > 0) {
      const teachers = await prisma.user.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, fullName: true },
      });
      for (const t of teachers) nameById.set(t.id, t.fullName);
    }

    const mapped: RevenueByChapterRow[] = rows.map((r) => ({
      chapter: { id: r.chapterId, name: r.chapterName },
      teacher: { id: r.teacherId, fullName: nameById.get(r.teacherId) ?? "—" },
      confirmedRevenue: Number(r.revenue ?? 0),
      successfulPayments: Number(r.cnt ?? 0),
    }));
    return paginate(mapped, page, limit);
  }

  async listCoursePayments(query: ListCoursePaymentsQuery): Promise<Paginated<CoursePaymentDTO>> {
    const { page, limit, q, status, teacherId, studentId, dateFrom, dateTo } = query;

    const where: Prisma.PaymentTransactionWhereInput = {
      ...(status ? { status } : {}),
      ...(studentId ? { studentId } : {}),
      ...(teacherId ? { chapter: { teacherId } } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(q
        ? {
            OR: [
              { student: { fullName: { contains: q, mode: "insensitive" } } },
              { student: { email: { contains: q, mode: "insensitive" } } },
              { chapter: { teacher: { fullName: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.findMany({
        where,
        select: {
          id: true, amount: true, currency: true, status: true, createdAt: true, updatedAt: true,
          student: { select: { id: true, fullName: true, email: true } },
          chapter: {
            select: {
              id: true, name: true,
              teacher: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((p) => this.toCoursePaymentDTO(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCoursePayment(paymentId: string): Promise<CoursePaymentDTO> {
    const p = await prisma.paymentTransaction.findUnique({
      where: { id: paymentId },
      select: {
        id: true, amount: true, currency: true, status: true, createdAt: true, updatedAt: true,
        student: { select: { id: true, fullName: true, email: true } },
        chapter: {
          select: {
            id: true, name: true,
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!p) throw new AppError("Payment not found", 404, "PAYMENT_NOT_FOUND");
    return this.toCoursePaymentDTO(p);
  }

  private toCoursePaymentDTO(p: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    student: { id: string; fullName: string; email: string };
    chapter: { id: string; name: string; teacher: { id: string; fullName: string } };
  }): CoursePaymentDTO {
    return {
      id: p.id,
      student: p.student,
      chapter: { id: p.chapter.id, name: p.chapter.name },
      teacher: { id: p.chapter.teacher.id, fullName: p.chapter.teacher.fullName },
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      // No dedicated paidAt column — approximate with the SUCCESS timestamp.
      paidAt: p.status === "SUCCESS" ? p.updatedAt.toISOString() : null,
    };
  }

  async listSubscriptionPayments(
    query: ListSubscriptionPaymentsQuery,
  ): Promise<Paginated<AdminPaymentDTO>> {
    const { page, limit, q, status, teacherId, dateFrom, dateTo } = query;

    const where: Prisma.TeacherSubscriptionPaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
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
      prisma.teacherSubscriptionPayment.count({ where }),
      prisma.teacherSubscriptionPayment.findMany({
        where,
        select: subPaymentSafeSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((p) => ({
        id: p.id,
        teacher: { id: p.teacher.id, fullName: p.teacher.fullName, email: p.teacher.email },
        plan: { id: p.plan.id, code: p.plan.code, displayName: p.plan.displayName },
        amount: p.amount,
        currency: p.currency,
        billingInterval: p.billingInterval,
        status: p.status,
        provider: p.provider,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.status === "SUCCESS" ? p.updatedAt.toISOString() : null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Delegates to the subscriptions module's sanitized payment DTO (404-safe). */
  async getSubscriptionPayment(paymentId: string): Promise<AdminPaymentDTO> {
    return adminSubscriptionsService.getPaymentDetail(paymentId);
  }
}

export const adminRevenueService = new AdminRevenueService();
