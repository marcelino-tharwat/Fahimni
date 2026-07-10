import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import type {
  AdminTeacherDetailResponse,
  Paginated,
  SafeSubscriptionPayment,
  TeacherAiUsageResponse,
  TeacherContentResponse,
  TeacherCurrentSubscription,
  TeacherDetailStats,
  TeacherEnrollmentItem,
  TeacherIdentity,
  TeacherRevenueResponse,
  TeacherScopedEnrollment,
  TeacherStudentItem,
  TeacherSubscriptionResponse,
} from "./admin-teacher-detail.types.js";
import { CURRENCY } from "./admin-teacher-detail.types.js";
import type {
  TeacherEnrollmentsQuery,
  TeacherStudentsQuery,
} from "./admin-teacher-detail.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

type SubStatus = "PENDING" | "SUCCESS" | "FAILED";

/**
 * Admin Teacher Detail read model. ADMIN-only (guarded at the router), read-only.
 *
 * SCOPING: every student/enrollment/course-revenue figure is scoped to the
 * SELECTED teacher through the ownership chain
 *   Enrollment / PaymentTransaction → Chapter → teacherId.
 * A student shared across teachers only ever surfaces THIS teacher's enrollments.
 *
 * REVENUE SEPARATION: course revenue (students buying this teacher's content) and
 * subscription payments (the teacher paying the platform for a plan) are distinct
 * figures, never summed.
 *
 * SAFE FIELDS ONLY: never selects password / tokenVersion / rawCallback /
 * paymob* ids / provider ids / checkoutUrl / storage paths.
 */
export class AdminTeacherDetailService {
  /**
   * Resolve a teacher by id, enforcing role = OPERATION. Any miss (bad uuid,
   * missing user, or non-OPERATION role) surfaces as a 404 so the detail page
   * can never be pointed at a student/admin account.
   */
  private async assertTeacher(teacherId: string): Promise<TeacherIdentity & { subject: string | null; bio: string | null; photoUrl: string | null }> {
    if (!UUID_RE.test(teacherId)) {
      throw new AppError("Teacher not found", 404, "TEACHER_NOT_FOUND");
    }
    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, role: "OPERATION" },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        status: true,
        createdAt: true,
        teacherProfile: { select: { subject: true, bio: true, photoUrl: true } },
      },
    });
    if (!teacher) {
      throw new AppError("Teacher not found", 404, "TEACHER_NOT_FOUND");
    }
    return {
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      mobile: teacher.mobile,
      status: teacher.status,
      createdAt: teacher.createdAt.toISOString(),
      subject: teacher.teacherProfile?.subject ?? null,
      bio: teacher.teacherProfile?.bio ?? null,
      photoUrl: teacher.teacherProfile?.photoUrl ?? null,
    };
  }

  async getDetail(teacherId: string): Promise<AdminTeacherDetailResponse> {
    const teacher = await this.assertTeacher(teacherId);

    const [stats, currentSubscription, pendingPayment, revenue] = await Promise.all([
      this.computeStats(teacherId),
      this.loadCurrentSubscription(teacherId),
      this.loadPendingSubscriptionPayment(teacherId),
      this.computeRevenueSummary(teacherId),
    ]);

    return {
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        email: teacher.email,
        mobile: teacher.mobile,
        status: teacher.status,
        createdAt: teacher.createdAt,
      },
      profile: {
        subject: teacher.subject,
        bio: teacher.bio,
        photoUrl: teacher.photoUrl,
      },
      stats,
      currentSubscription,
      pendingSubscriptionPayment: pendingPayment,
      revenue,
    };
  }

  private async computeStats(teacherId: string): Promise<TeacherDetailStats> {
    const chapterTeacherWhere = { teacherId };
    const [
      stagesCount,
      chaptersCount,
      lessonsCount,
      quizzesCount,
      enrollmentsCount,
      activeEnrollmentsCount,
      pendingEnrollmentsCount,
      distinctStudents,
      aiUsage,
    ] = await Promise.all([
      prisma.stage.count({ where: { deletedAt: null, chapters: { some: { teacherId, deletedAt: null } } } }),
      prisma.chapter.count({ where: { deletedAt: null, ...chapterTeacherWhere } }),
      prisma.lesson.count({ where: { deletedAt: null, chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.quiz.count({ where: { chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.enrollment.count({ where: { chapter: chapterTeacherWhere } }),
      prisma.enrollment.count({ where: { status: "ACTIVE", chapter: chapterTeacherWhere } }),
      prisma.enrollment.count({ where: { status: "PAYMENT_PENDING", chapter: chapterTeacherWhere } }),
      prisma.enrollment.findMany({
        where: { chapter: chapterTeacherWhere },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.teacherAiUsageEvent.count({ where: { teacherId } }),
    ]);

    return {
      stagesCount,
      chaptersCount,
      lessonsCount,
      quizzesCount,
      studentsCount: distinctStudents.length,
      enrollmentsCount,
      activeEnrollmentsCount,
      pendingEnrollmentsCount,
      aiUsage,
    };
  }

  private async loadCurrentSubscription(
    teacherId: string,
  ): Promise<TeacherCurrentSubscription | null> {
    const subs = await prisma.teacherSubscription.findMany({
      where: { teacherId, status: { in: ["ACTIVE", "TRIALING"] } },
      select: {
        status: true,
        billingInterval: true,
        startedAt: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        plan: { select: { code: true, name: true, displayName: true } },
      },
      orderBy: { currentPeriodEnd: "desc" },
    });
    // Prefer an ACTIVE subscription over a TRIALING one.
    const chosen = subs.find((s) => s.status === "ACTIVE") ?? subs[0];
    if (!chosen) return null;
    return {
      status: chosen.status,
      billingInterval: chosen.billingInterval,
      startedAt: chosen.startedAt.toISOString(),
      currentPeriodStart: chosen.currentPeriodStart.toISOString(),
      currentPeriodEnd: chosen.currentPeriodEnd.toISOString(),
      plan: {
        code: chosen.plan.code,
        name: chosen.plan.name,
        displayName: chosen.plan.displayName,
      },
    };
  }

  private toSafeSubPayment(row: {
    id: string;
    amount: number;
    currency: string;
    billingInterval: SafeSubscriptionPayment["billingInterval"];
    status: SubStatus;
    createdAt: Date;
    plan: { code: string; displayName: string };
  }): SafeSubscriptionPayment {
    return {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      billingInterval: row.billingInterval,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      plan: { code: row.plan.code, displayName: row.plan.displayName },
    };
  }

  private async loadPendingSubscriptionPayment(
    teacherId: string,
  ): Promise<SafeSubscriptionPayment | null> {
    const row = await prisma.teacherSubscriptionPayment.findFirst({
      where: { teacherId, status: "PENDING" },
      select: {
        id: true,
        amount: true,
        currency: true,
        billingInterval: true,
        status: true,
        createdAt: true,
        plan: { select: { code: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return row ? this.toSafeSubPayment(row) : null;
  }

  private async computeRevenueSummary(
    teacherId: string,
  ): Promise<AdminTeacherDetailResponse["revenue"]> {
    const monthStart = startOfCurrentMonthUtc();
    const courseWhere = { status: "SUCCESS" as const, chapter: { teacherId } };
    const [course, monthly, sub] = await Promise.all([
      prisma.paymentTransaction.aggregate({ where: courseWhere, _sum: { amount: true } }),
      prisma.paymentTransaction.aggregate({
        where: { ...courseWhere, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.teacherSubscriptionPayment.aggregate({
        where: { teacherId, status: "SUCCESS" },
        _sum: { amount: true },
      }),
    ]);
    return {
      confirmedCourseRevenue: Number(course._sum.amount ?? 0),
      monthlyConfirmedCourseRevenue: Number(monthly._sum.amount ?? 0),
      confirmedSubscriptionPayments: Number(sub._sum.amount ?? 0),
      currency: CURRENCY,
    };
  }

  // ── Students tab ──
  async getStudents(
    teacherId: string,
    query: TeacherStudentsQuery,
  ): Promise<Paginated<TeacherStudentItem>> {
    await this.assertTeacher(teacherId);
    const { page, limit, q } = query;

    // Students connected to THIS teacher = students with ≥1 enrollment through
    // the teacher's chapters. The search term filters the student, never leaks
    // other teachers' content.
    const studentWhere = {
      role: "STUDENT" as const,
      enrollments: { some: { chapter: { teacherId } } },
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, students] = await prisma.$transaction([
      prisma.user.count({ where: studentWhere }),
      prisma.user.findMany({
        where: studentWhere,
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          status: true,
          // CRITICAL: only enrollments through THIS teacher's chapters.
          enrollments: {
            where: { chapter: { teacherId } },
            select: {
              id: true,
              status: true,
              price: true,
              paymentMethod: true,
              enrolledAt: true,
              chapter: {
                select: {
                  id: true,
                  name: true,
                  stage: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { enrolledAt: "desc" },
          },
        },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: TeacherStudentItem[] = students.map((s) => {
      const enrollments: TeacherScopedEnrollment[] = s.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        price: e.price,
        paymentMethod: e.paymentMethod,
        enrolledAt: e.enrolledAt.toISOString(),
        chapter: {
          id: e.chapter.id,
          name: e.chapter.name,
          stageId: e.chapter.stage.id,
          stageName: e.chapter.stage.name,
        },
      }));
      return {
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        mobile: s.mobile,
        status: s.status,
        enrollmentsCount: enrollments.length,
        activeEnrollmentsCount: enrollments.filter((e) => e.status === "ACTIVE").length,
        pendingEnrollmentsCount: enrollments.filter((e) => e.status === "PAYMENT_PENDING").length,
        enrollments,
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ── Enrollments tab ──
  async getEnrollments(
    teacherId: string,
    query: TeacherEnrollmentsQuery,
  ): Promise<Paginated<TeacherEnrollmentItem>> {
    await this.assertTeacher(teacherId);
    const { page, limit, status } = query;

    const where = {
      chapter: { teacherId },
      ...(status ? { status } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        select: {
          id: true,
          status: true,
          price: true,
          paymentMethod: true,
          enrolledAt: true,
          student: { select: { id: true, fullName: true, email: true } },
          chapter: {
            select: {
              id: true,
              name: true,
              stage: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: TeacherEnrollmentItem[] = rows.map((e) => ({
      id: e.id,
      status: e.status,
      price: e.price,
      paymentMethod: e.paymentMethod,
      enrolledAt: e.enrolledAt.toISOString(),
      student: { id: e.student.id, fullName: e.student.fullName, email: e.student.email },
      chapter: {
        id: e.chapter.id,
        name: e.chapter.name,
        stageId: e.chapter.stage.id,
        stageName: e.chapter.stage.name,
      },
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ── Content tab ──
  async getContent(teacherId: string): Promise<TeacherContentResponse> {
    await this.assertTeacher(teacherId);
    const chapterTeacherWhere = { teacherId };

    const [
      stagesCount,
      chaptersCount,
      lessonsCount,
      quizzesCount,
      publishedQuizzesCount,
      draftQuizzesCount,
      stages,
    ] = await Promise.all([
      prisma.stage.count({ where: { deletedAt: null, chapters: { some: { teacherId, deletedAt: null } } } }),
      prisma.chapter.count({ where: { deletedAt: null, ...chapterTeacherWhere } }),
      prisma.lesson.count({ where: { deletedAt: null, chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.quiz.count({ where: { chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.quiz.count({ where: { status: "PUBLISHED", chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.quiz.count({ where: { status: "DRAFT", chapter: { deletedAt: null, ...chapterTeacherWhere } } }),
      prisma.stage.findMany({
        where: { deletedAt: null, chapters: { some: { teacherId, deletedAt: null } } },
        select: {
          id: true,
          name: true,
          chapters: {
            where: { teacherId, deletedAt: null },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  lessons: { where: { deletedAt: null } },
                  quizzes: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return {
      counts: {
        stagesCount,
        chaptersCount,
        lessonsCount,
        quizzesCount,
        publishedQuizzesCount,
        draftQuizzesCount,
      },
      stages: stages.map((st) => ({
        id: st.id,
        name: st.name,
        chaptersCount: st.chapters.length,
        chapters: st.chapters.map((c) => ({
          id: c.id,
          name: c.name,
          lessonsCount: c._count.lessons,
          quizzesCount: c._count.quizzes,
        })),
      })),
    };
  }

  // ── Revenue tab ──
  async getRevenue(teacherId: string): Promise<TeacherRevenueResponse> {
    await this.assertTeacher(teacherId);
    const monthStart = startOfCurrentMonthUtc();
    const scoped = { chapter: { teacherId } };

    const [
      confirmedAgg,
      monthlyAgg,
      successCount,
      pendingCount,
      failedCount,
      recent,
      subSuccessAgg,
      subSuccessCount,
      subPendingCount,
      subFailedCount,
    ] = await Promise.all([
      prisma.paymentTransaction.aggregate({ where: { ...scoped, status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.paymentTransaction.aggregate({
        where: { ...scoped, status: "SUCCESS", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.paymentTransaction.count({ where: { ...scoped, status: "SUCCESS" } }),
      prisma.paymentTransaction.count({ where: { ...scoped, status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { ...scoped, status: "FAILED" } }),
      prisma.paymentTransaction.findMany({
        where: scoped,
        // Safe columns only — NEVER paymobOrderId / paymobTransactionId / rawCallback.
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          student: { select: { id: true, fullName: true } },
          chapter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.teacherSubscriptionPayment.aggregate({ where: { teacherId, status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.teacherSubscriptionPayment.count({ where: { teacherId, status: "SUCCESS" } }),
      prisma.teacherSubscriptionPayment.count({ where: { teacherId, status: "PENDING" } }),
      prisma.teacherSubscriptionPayment.count({ where: { teacherId, status: "FAILED" } }),
    ]);

    return {
      currency: CURRENCY,
      confirmedCourseRevenue: Number(confirmedAgg._sum.amount ?? 0),
      monthlyConfirmedCourseRevenue: Number(monthlyAgg._sum.amount ?? 0),
      coursePayments: {
        successCount,
        pendingCount,
        failedCount,
        recent: recent.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          student: { id: p.student.id, fullName: p.student.fullName },
          chapter: { id: p.chapter.id, name: p.chapter.name },
        })),
      },
      subscriptionPayments: {
        confirmedTotal: Number(subSuccessAgg._sum.amount ?? 0),
        successCount: subSuccessCount,
        pendingCount: subPendingCount,
        failedCount: subFailedCount,
      },
    };
  }

  // ── Subscription tab ──
  async getSubscription(teacherId: string): Promise<TeacherSubscriptionResponse> {
    await this.assertTeacher(teacherId);
    const [currentSubscription, pendingPayment, latest, failedPaymentsCount] = await Promise.all([
      this.loadCurrentSubscription(teacherId),
      this.loadPendingSubscriptionPayment(teacherId),
      prisma.teacherSubscriptionPayment.findMany({
        where: { teacherId, status: "SUCCESS" },
        // Safe columns only — NEVER rawCallback / checkoutUrl / provider ids.
        select: {
          id: true,
          amount: true,
          currency: true,
          billingInterval: true,
          status: true,
          createdAt: true,
          plan: { select: { code: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.teacherSubscriptionPayment.count({ where: { teacherId, status: "FAILED" } }),
    ]);

    return {
      currentSubscription,
      pendingPayment,
      latestSuccessfulPayments: latest.map((r) => this.toSafeSubPayment(r)),
      failedPaymentsCount,
    };
  }

  // ── AI usage tab ──
  async getAiUsage(teacherId: string): Promise<TeacherAiUsageResponse> {
    await this.assertTeacher(teacherId);
    const monthStart = startOfCurrentMonthUtc();

    const [grouped, monthGrouped] = await Promise.all([
      prisma.teacherAiUsageEvent.groupBy({
        by: ["usageType"],
        where: { teacherId },
        _count: { _all: true },
        _sum: { units: true },
      }),
      prisma.teacherAiUsageEvent.groupBy({
        by: ["usageType"],
        where: { teacherId, createdAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { units: true },
      }),
    ]);

    const byType = grouped.map((g) => ({
      type: g.usageType,
      events: g._count._all,
      units: Number(g._sum.units ?? 0),
    }));

    const totalEvents = byType.reduce((s, r) => s + r.events, 0);
    const totalUnits = byType.reduce((s, r) => s + r.units, 0);
    const currentMonth = monthGrouped.reduce(
      (acc, g) => ({
        events: acc.events + g._count._all,
        units: acc.units + Number(g._sum.units ?? 0),
      }),
      { events: 0, units: 0 },
    );

    return { byType, totalEvents, totalUnits, currentMonth };
  }
}

export const adminTeacherDetailService = new AdminTeacherDetailService();
