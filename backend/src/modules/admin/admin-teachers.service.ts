import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ListTeachersQuery } from "./admin-teachers.validation.js";
import type {
  AdminTeacherListItem,
  AdminTeachersListResponse,
  TeacherCurrentSubscription,
  TeacherPendingSubscriptionPayment,
  TeacherStats,
} from "./admin-teachers.types.js";

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function emptyStats(): TeacherStats {
  return {
    stagesCount: 0,
    chaptersCount: 0,
    lessonsCount: 0,
    quizzesCount: 0,
    studentsCount: 0,
    enrollmentsCount: 0,
    confirmedCourseRevenue: 0,
    confirmedSubscriptionPayments: 0,
    monthlyConfirmedCourseRevenue: 0,
    aiUsage: 0,
  };
}

type CountRow = { tid: string; cnt: number };
type SumRow = { tid: string; val: number };

/**
 * Admin Teachers Management read model.
 *
 * Read-only, ADMIN-only aggregation over teachers (User.role = OPERATION). Only
 * non-sensitive columns are ever selected — never password / tokenVersion /
 * rawCallback / provider ids / storage paths.
 *
 * Metric attribution (all teacher-scoped through the ownership chain
 * Enrollment/Payment → Chapter → Stage.teacherId, matching the admin dashboard):
 *  - studentsCount  = COUNT(DISTINCT enrollment.studentId) through that chain.
 *  - enrollmentsCount = COUNT(enrollment) through that chain.
 *  - confirmedCourseRevenue = SUM(SUCCESS PaymentTransaction.amount) through it.
 *  - confirmedSubscriptionPayments = SUM(SUCCESS TeacherSubscriptionPayment.amount)
 *    keyed directly on teacherId. THIS IS PLATFORM REVENUE PAID BY THE TEACHER and
 *    is reported separately from course revenue — the two are never summed.
 *  - content counts (stages/chapters/lessons/quizzes) exclude soft-deleted rows.
 */
export class AdminTeachersService {
  async listTeachers(query: ListTeachersQuery): Promise<AdminTeachersListResponse> {
    const { page, limit, q, status, sortBy, sort } = query;

    const where: Prisma.UserWhereInput = {
      role: "OPERATION",
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sort };

    const [total, teachers] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          status: true,
          createdAt: true,
          teacherProfile: { select: { subject: true, photoUrl: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const ids = teachers.map((t) => t.id);

    if (ids.length === 0) {
      return { data: [], meta: { page, limit, total, totalPages } };
    }

    const [statsById, subsById, pendingById] = await Promise.all([
      this.aggregateStats(ids),
      this.loadCurrentSubscriptions(ids),
      this.loadPendingSubscriptionPayments(ids),
    ]);

    const data: AdminTeacherListItem[] = teachers.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      email: t.email,
      mobile: t.mobile,
      status: t.status,
      profile: {
        subject: t.teacherProfile?.subject ?? null,
        photoUrl: t.teacherProfile?.photoUrl ?? null,
      },
      stats: statsById.get(t.id) ?? emptyStats(),
      currentSubscription: subsById.get(t.id) ?? null,
      pendingSubscriptionPayment: pendingById.get(t.id) ?? null,
      createdAt: t.createdAt.toISOString(),
    }));

    return { data, meta: { page, limit, total, totalPages } };
  }

  /**
   * Compute every per-teacher metric for the given (small, page-sized) id set.
   * Chain-joined metrics use grouped raw SQL (Chapter has no teacherId column);
   * teacherId-native metrics use Prisma groupBy.
   */
  private async aggregateStats(ids: string[]): Promise<Map<string, TeacherStats>> {
    const monthStart = startOfCurrentMonthUtc();
    const idList = Prisma.join(ids);

    const [
      stages,
      chapters,
      lessons,
      quizzes,
      enrollments,
      students,
      courseRevenue,
      monthlyCourseRevenue,
      subscriptionPayments,
      aiUsage,
    ] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(*)::int AS cnt
        FROM stages s
        WHERE s."teacherId" IN (${idList}) AND s."deletedAt" IS NULL
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(*)::int AS cnt
        FROM chapters c JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
          AND c."deletedAt" IS NULL AND s."deletedAt" IS NULL
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(*)::int AS cnt
        FROM lessons l
        JOIN chapters c ON c.id = l."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
          AND l."deletedAt" IS NULL AND c."deletedAt" IS NULL AND s."deletedAt" IS NULL
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(*)::int AS cnt
        FROM quizzes q
        JOIN chapters c ON c.id = q."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
          AND c."deletedAt" IS NULL AND s."deletedAt" IS NULL
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(*)::int AS cnt
        FROM enrollments e
        JOIN chapters c ON c.id = e."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT s."teacherId" AS tid, COUNT(DISTINCT e."studentId")::int AS cnt
        FROM enrollments e
        JOIN chapters c ON c.id = e."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<SumRow[]>`
        SELECT s."teacherId" AS tid, COALESCE(SUM(pt.amount), 0)::float8 AS val
        FROM payment_transactions pt
        JOIN chapters c ON c.id = pt."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList}) AND pt.status = 'SUCCESS'
        GROUP BY s."teacherId"`,
      prisma.$queryRaw<SumRow[]>`
        SELECT s."teacherId" AS tid, COALESCE(SUM(pt.amount), 0)::float8 AS val
        FROM payment_transactions pt
        JOIN chapters c ON c.id = pt."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE s."teacherId" IN (${idList})
          AND pt.status = 'SUCCESS' AND pt."createdAt" >= ${monthStart}
        GROUP BY s."teacherId"`,
      prisma.teacherSubscriptionPayment.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: ids }, status: "SUCCESS" },
        _sum: { amount: true },
      }),
      prisma.teacherAiUsageEvent.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const countMap = (rows: CountRow[]) =>
      new Map(rows.map((r) => [r.tid, Number(r.cnt)]));
    const sumMap = (rows: SumRow[]) =>
      new Map(rows.map((r) => [r.tid, Number(r.val)]));

    const stagesM = countMap(stages);
    const chaptersM = countMap(chapters);
    const lessonsM = countMap(lessons);
    const quizzesM = countMap(quizzes);
    const enrollmentsM = countMap(enrollments);
    const studentsM = countMap(students);
    const courseRevM = sumMap(courseRevenue);
    const monthlyRevM = sumMap(monthlyCourseRevenue);
    const subPayM = new Map(
      subscriptionPayments.map((r) => [r.teacherId, Number(r._sum.amount ?? 0)]),
    );
    const aiM = new Map(aiUsage.map((r) => [r.teacherId, r._count._all]));

    const out = new Map<string, TeacherStats>();
    for (const id of ids) {
      out.set(id, {
        stagesCount: stagesM.get(id) ?? 0,
        chaptersCount: chaptersM.get(id) ?? 0,
        lessonsCount: lessonsM.get(id) ?? 0,
        quizzesCount: quizzesM.get(id) ?? 0,
        studentsCount: studentsM.get(id) ?? 0,
        enrollmentsCount: enrollmentsM.get(id) ?? 0,
        confirmedCourseRevenue: courseRevM.get(id) ?? 0,
        confirmedSubscriptionPayments: subPayM.get(id) ?? 0,
        monthlyConfirmedCourseRevenue: monthlyRevM.get(id) ?? 0,
        aiUsage: aiM.get(id) ?? 0,
      });
    }
    return out;
  }

  /** Current ACTIVE (preferred) or TRIALING subscription per teacher, plan-resolved. */
  private async loadCurrentSubscriptions(
    ids: string[],
  ): Promise<Map<string, TeacherCurrentSubscription>> {
    const subs = await prisma.teacherSubscription.findMany({
      where: { teacherId: { in: ids }, status: { in: ["ACTIVE", "TRIALING"] } },
      select: {
        teacherId: true,
        status: true,
        billingInterval: true,
        currentPeriodEnd: true,
        plan: { select: { code: true, name: true, displayName: true } },
      },
      orderBy: { currentPeriodEnd: "desc" },
    });

    const out = new Map<string, TeacherCurrentSubscription>();
    for (const s of subs) {
      const existing = out.get(s.teacherId);
      // Prefer an ACTIVE subscription over a TRIALING one when both exist.
      if (existing && existing.status === "ACTIVE" && s.status !== "ACTIVE") continue;
      out.set(s.teacherId, {
        status: s.status,
        billingInterval: s.billingInterval,
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        plan: {
          code: s.plan.code,
          name: s.plan.name,
          displayName: s.plan.displayName,
        },
      });
    }
    return out;
  }

  /** Latest PENDING subscription payment per teacher (safe fields only). */
  private async loadPendingSubscriptionPayments(
    ids: string[],
  ): Promise<Map<string, TeacherPendingSubscriptionPayment>> {
    const rows = await prisma.teacherSubscriptionPayment.findMany({
      where: { teacherId: { in: ids }, status: "PENDING" },
      select: {
        teacherId: true,
        amount: true,
        currency: true,
        billingInterval: true,
        createdAt: true,
        plan: { select: { code: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const out = new Map<string, TeacherPendingSubscriptionPayment>();
    for (const r of rows) {
      // findMany is ordered newest-first; keep only the first (latest) per teacher.
      if (out.has(r.teacherId)) continue;
      out.set(r.teacherId, {
        amount: r.amount,
        currency: r.currency,
        billingInterval: r.billingInterval,
        createdAt: r.createdAt.toISOString(),
        plan: { code: r.plan.code, displayName: r.plan.displayName },
      });
    }
    return out;
  }
}

export const adminTeachersService = new AdminTeachersService();
