import { prisma } from "../../config/database.js";
import type {
  AdminStatsResponse,
  TopTeacherByRevenue,
  TopTeacherByStudents,
} from "./admin-stats.types.js";

const CURRENCY = "EGP";
const TOP_TEACHERS_LIMIT = 5;

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Computes global platform metrics for the admin dashboard.
 *
 * Read-only aggregation across all teachers/students. Selects only non-sensitive
 * columns (never password / tokenVersion / rawCallback / filePath / storageKey /
 * provider payloads).
 *
 * Revenue policy:
 *  - confirmedCourseRevenue        = successful student course PaymentTransaction.
 *  - confirmedTeacherSubscription  = successful TeacherSubscriptionPayment (what
 *                                    teachers pay the PLATFORM for a plan).
 *  - topTeachers.byRevenue counts ONLY teacher-owned course revenue — teacher
 *    subscription payments are platform revenue (a cost to the teacher), not
 *    revenue the teacher earned, so they are deliberately excluded from the
 *    teacher-revenue ranking.
 */
export class AdminStatsService {
  async getStats(): Promise<AdminStatsResponse> {
    const monthStart = startOfCurrentMonthUtc();

    const [
      totalTeachers,
      activeTeachers,
      totalStudents,
      activeStudents,
      studentsWithActiveEnrollment,
      studentsWithAnyEnrollment,
      totalStages,
      totalChapters,
      totalLessons,
      totalMaterials,
      totalQuizzes,
      publishedQuizzes,
      draftQuizzes,
      totalEnrollments,
      activeEnrollments,
      pendingEnrollments,
      quizAttempts,
      avgScoreRows,
      courseRevenueAgg,
      monthlyCourseRevenueAgg,
      subRevenueAgg,
      monthlySubRevenueAgg,
      pendingTeacherRequests,
      activeTeacherSubscriptions,
      pendingTeacherSubscriptionRequests,
      pendingTeacherSubscriptionPayments,
      failedTeacherSubscriptionPayments,
      quizGenAgg,
      essayGradingAgg,
      totalAiEvents,
      byRevenue,
      byStudents,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "OPERATION" } }),
      prisma.user.count({ where: { role: "OPERATION", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      prisma.enrollment.findMany({
        where: { status: "ACTIVE", student: { role: "STUDENT" } },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.enrollment.findMany({
        where: { student: { role: "STUDENT" } },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.stage.count({ where: { deletedAt: null } }),
      prisma.chapter.count({ where: { deletedAt: null } }),
      prisma.lesson.count({ where: { deletedAt: null } }),
      prisma.lessonMaterial.count({ where: { deletedAt: null } }),
      prisma.quiz.count(),
      prisma.quiz.count({ where: { status: "PUBLISHED" } }),
      prisma.quiz.count({ where: { status: "DRAFT" } }),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { status: "PAYMENT_PENDING" } }),
      prisma.quizAttempt.count(),
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG(score::float / "totalPoints" * 100) AS avg
        FROM quiz_attempts
        WHERE score IS NOT NULL AND "totalPoints" > 0
      `,
      prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amount: true },
      }),
      prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.teacherSubscriptionPayment.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amount: true },
      }),
      prisma.teacherSubscriptionPayment.aggregate({
        where: { status: "SUCCESS", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.teacherRegistrationRequest.count({ where: { status: "PENDING" } }),
      prisma.teacherSubscription.count({ where: { status: "ACTIVE" } }),
      prisma.teacherSubscriptionRequest.count({ where: { status: "PENDING" } }),
      prisma.teacherSubscriptionPayment.count({ where: { status: "PENDING" } }),
      prisma.teacherSubscriptionPayment.count({ where: { status: "FAILED" } }),
      prisma.teacherAiUsageEvent.aggregate({
        where: { usageType: "AI_QUIZ_GENERATION" },
        _sum: { units: true },
      }),
      prisma.teacherAiUsageEvent.aggregate({
        where: { usageType: "AI_ESSAY_GRADING" },
        _sum: { units: true },
      }),
      prisma.teacherAiUsageEvent.count(),
      this.topTeachersByRevenue(),
      this.topTeachersByStudents(),
    ]);

    const studentsWithoutTeacher = Math.max(
      0,
      totalStudents - studentsWithActiveEnrollment.length,
    );
    const studentsWithoutAnyEnrollment = Math.max(
      0,
      totalStudents - studentsWithAnyEnrollment.length,
    );

    const averageQuizScore =
      avgScoreRows[0]?.avg != null
        ? Math.round(Number(avgScoreRows[0].avg) * 10) / 10
        : 0;

    const confirmedCourseRevenue = Number(courseRevenueAgg._sum.amount ?? 0);
    const confirmedTeacherSubscriptionRevenue = Number(subRevenueAgg._sum.amount ?? 0);
    const totalConfirmedRevenue =
      confirmedCourseRevenue + confirmedTeacherSubscriptionRevenue;
    const monthlyConfirmedRevenue =
      Number(monthlyCourseRevenueAgg._sum.amount ?? 0) +
      Number(monthlySubRevenueAgg._sum.amount ?? 0);

    const reliabilityWarnings: string[] = [
      "إيرادات الكورسات المؤكدة تحتسب فقط مدفوعات Paymob الناجحة؛ الاشتراكات المجانية أو عبر الأكواد غير محتسبة.",
      "المبالغ المستردة والإلغاءات غير محتسبة في الإيرادات.",
    ];

    // Prefer confirmed subscription payments. Only fall back to an estimate when
    // there are no confirmed TeacherSubscriptionPayment rows at all.
    let estimatedSubscriptionRevenue = 0;
    if (confirmedTeacherSubscriptionRevenue > 0) {
      reliabilityWarnings.push(
        "إيراد اشتراكات المدرسين محسوب من مدفوعات الاشتراك المؤكدة (القيمة التقديرية غير مستخدمة).",
      );
    } else {
      estimatedSubscriptionRevenue = await this.estimateSubscriptionRevenue();
      reliabilityWarnings.push(
        "إيراد اشتراكات المدرسين تقديري بناءً على الاشتراكات النشطة × سعر الباقة (لا توجد مدفوعات اشتراك مؤكدة بعد).",
      );
    }

    reliabilityWarnings.push(
      "ترتيب المدرسين حسب الإيراد يعتمد على إيرادات الكورسات المملوكة للمدرس فقط؛ مدفوعات اشتراكات المدرسين تُعد إيراداً للمنصة وليست إيراداً للمدرس.",
    );

    return {
      users: {
        totalTeachers,
        activeTeachers,
        totalStudents,
        activeStudents,
        studentsWithoutTeacher,
        studentsWithoutAnyEnrollment,
      },
      content: {
        totalStages,
        totalChapters,
        totalLessons,
        totalMaterials,
        totalQuizzes,
        publishedQuizzes,
        draftQuizzes,
      },
      learning: {
        totalEnrollments,
        activeEnrollments,
        pendingEnrollments,
        quizAttempts,
        averageQuizScore,
      },
      finance: {
        confirmedCourseRevenue,
        confirmedTeacherSubscriptionRevenue,
        totalConfirmedRevenue,
        monthlyConfirmedRevenue,
        estimatedSubscriptionRevenue,
        currency: CURRENCY,
        reliabilityWarnings,
      },
      operations: {
        pendingTeacherRequests,
        activeTeacherSubscriptions,
        pendingTeacherSubscriptionRequests,
        pendingTeacherSubscriptionPayments,
        failedTeacherSubscriptionPayments,
      },
      ai: {
        quizGenerations: Number(quizGenAgg._sum.units ?? 0),
        essayGrading: Number(essayGradingAgg._sum.units ?? 0),
        totalAiEvents,
      },
      topTeachers: {
        byRevenue,
        byStudents,
      },
    };
  }

  /**
   * Estimated subscription revenue = sum over ACTIVE subscriptions of the plan
   * price for the subscription's billing interval. Used only when there are no
   * confirmed subscription payments yet.
   */
  private async estimateSubscriptionRevenue(): Promise<number> {
    const subs = await prisma.teacherSubscription.findMany({
      where: { status: "ACTIVE" },
      select: {
        billingInterval: true,
        plan: { select: { monthlyPrice: true, yearlyPrice: true } },
      },
    });
    let total = 0;
    for (const sub of subs) {
      if (sub.billingInterval === "YEARLY") {
        total += sub.plan.yearlyPrice ?? 0;
      } else {
        total += sub.plan.monthlyPrice;
      }
    }
    return Math.round(total * 100) / 100;
  }

  private async topTeachersByRevenue(): Promise<TopTeacherByRevenue[]> {
    const rows = await prisma.$queryRaw<
      { teacherId: string; revenue: number | null }[]
    >`
      SELECT s."teacherId" AS "teacherId", SUM(pt.amount) AS revenue
      FROM payment_transactions pt
      JOIN chapters c ON c.id = pt."chapterId"
      JOIN stages s ON s.id = c."stageId"
      WHERE pt.status = 'SUCCESS'
      GROUP BY s."teacherId"
      ORDER BY revenue DESC
      LIMIT ${TOP_TEACHERS_LIMIT}
    `;
    return this.attachTeacherNames(
      rows.map((r) => ({ teacherId: r.teacherId, revenue: Number(r.revenue ?? 0) })),
      (base, name) => ({ ...base, fullName: name }),
    );
  }

  private async topTeachersByStudents(): Promise<TopTeacherByStudents[]> {
    const rows = await prisma.$queryRaw<
      { teacherId: string; students: bigint | number | null }[]
    >`
      SELECT s."teacherId" AS "teacherId", COUNT(DISTINCT e."studentId") AS students
      FROM enrollments e
      JOIN chapters c ON c.id = e."chapterId"
      JOIN stages s ON s.id = c."stageId"
      WHERE e.status = 'ACTIVE'
      GROUP BY s."teacherId"
      ORDER BY students DESC
      LIMIT ${TOP_TEACHERS_LIMIT}
    `;
    return this.attachTeacherNames(
      rows.map((r) => ({ teacherId: r.teacherId, studentCount: Number(r.students ?? 0) })),
      (base, name) => ({ ...base, fullName: name }),
    );
  }

  /**
   * Resolve teacher display names for a list of rows keyed by teacherId.
   * Selects ONLY id + fullName — never email/mobile/password/etc.
   */
  private async attachTeacherNames<T extends { teacherId: string }, R>(
    rows: T[],
    merge: (row: T, fullName: string) => R,
  ): Promise<R[]> {
    if (rows.length === 0) return [];
    const teachers = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.teacherId) } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(teachers.map((t) => [t.id, t.fullName]));
    return rows.map((r) => merge(r, nameById.get(r.teacherId) ?? "—"));
  }
}

export const adminStatsService = new AdminStatsService();
