import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { CURRENCY } from "./admin-students.types.js";
import type {
  AdminStudentDetailResponse,
  AdminStudentListItem,
  Paginated,
  StudentEnrollmentItem,
  StudentIdentity,
  StudentLearningSummary,
  StudentPaymentsResponse,
  StudentTeacherRef,
} from "./admin-students.types.js";
import type {
  ListStudentsQuery,
  StudentEnrollmentsQuery,
} from "./admin-students.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin Students Management read model. ADMIN-only, read-only.
 *
 * A student may belong to multiple teachers; teachers are always resolved as the
 * DISTINCT set of teachers reached through the student's enrollments
 * (Enrollment → Chapter → teacher). Every enrollment is teacher-connected
 * (a chapter always has a teacherId), so "ACTIVE enrollment connected to a
 * teacher" is equivalent to "ACTIVE enrollment".
 *
 * SAFE FIELDS ONLY — never selects password / tokenVersion / rawCallback /
 * paymob* ids / provider ids / storage paths.
 */
export class AdminStudentsService {
  /** Build the role=STUDENT filter for the list, per the documented definitions. */
  private buildWhere(query: ListStudentsQuery): Prisma.UserWhereInput {
    const { q, status, filter } = query;
    const where: Prisma.UserWhereInput = { role: "STUDENT" };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
      ];
    }

    switch (filter) {
      case "active":
        // ≥1 ACTIVE enrollment (every enrollment is teacher-connected).
        where.enrollments = { some: { status: "ACTIVE" } };
        break;
      case "without_enrollment":
        where.enrollments = { none: {} };
        break;
      case "without_active_teacher":
        // No ACTIVE enrollment — covers zero-enrollment and pending-only students.
        where.enrollments = { none: { status: "ACTIVE" } };
        break;
      case "payment_pending":
        where.AND = [
          {
            OR: [
              { enrollments: { some: { status: "PAYMENT_PENDING" } } },
              { paymentTransactions: { some: { status: "PENDING" } } },
            ],
          },
        ];
        break;
      case "all":
      default:
        break;
    }
    return where;
  }

  async listStudents(query: ListStudentsQuery): Promise<Paginated<AdminStudentListItem>> {
    const { page, limit, sortBy, sort } = query;
    const where = this.buildWhere(query);
    const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sort };

    const [total, students] = await prisma.$transaction([
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
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const ids = students.map((s) => s.id);
    if (ids.length === 0) {
      return { data: [], meta: { page, limit, total, totalPages } };
    }

    // One enrollments read for the whole page (no N+1). Resolve teacher through
    // chapter.teacher, plus counts and latestEnrollmentAt per student.
    const [enrollments, pendingPayments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { studentId: { in: ids } },
        select: {
          studentId: true,
          status: true,
          enrolledAt: true,
          chapter: {
            select: {
              teacher: {
                select: {
                  id: true,
                  fullName: true,
                  teacherProfile: { select: { subject: true } },
                },
              },
            },
          },
        },
      }),
      prisma.paymentTransaction.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids }, status: "PENDING" },
        _count: { _all: true },
      }),
    ]);

    interface Agg {
      enrollmentsCount: number;
      activeEnrollmentsCount: number;
      pendingEnrollmentsCount: number;
      teachers: Map<string, StudentTeacherRef>;
      latestEnrollmentAt: Date | null;
    }
    const aggByStudent = new Map<string, Agg>();
    for (const id of ids) {
      aggByStudent.set(id, {
        enrollmentsCount: 0,
        activeEnrollmentsCount: 0,
        pendingEnrollmentsCount: 0,
        teachers: new Map(),
        latestEnrollmentAt: null,
      });
    }
    for (const e of enrollments) {
      const agg = aggByStudent.get(e.studentId);
      if (!agg) continue;
      agg.enrollmentsCount += 1;
      if (e.status === "ACTIVE") agg.activeEnrollmentsCount += 1;
      if (e.status === "PAYMENT_PENDING") agg.pendingEnrollmentsCount += 1;
      const teacher = e.chapter.teacher;
      if (teacher && !agg.teachers.has(teacher.id)) {
        agg.teachers.set(teacher.id, {
          id: teacher.id,
          fullName: teacher.fullName,
          subject: teacher.teacherProfile?.subject ?? null,
        });
      }
      if (!agg.latestEnrollmentAt || e.enrolledAt > agg.latestEnrollmentAt) {
        agg.latestEnrollmentAt = e.enrolledAt;
      }
    }
    const pendingPayMap = new Map(
      pendingPayments.map((p) => [p.studentId, p._count._all]),
    );

    const data: AdminStudentListItem[] = students.map((s) => {
      const agg = aggByStudent.get(s.id)!;
      const teachers = [...agg.teachers.values()];
      return {
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        mobile: s.mobile,
        status: s.status,
        enrollmentsCount: agg.enrollmentsCount,
        activeEnrollmentsCount: agg.activeEnrollmentsCount,
        pendingEnrollmentsCount: agg.pendingEnrollmentsCount,
        teachersCount: teachers.length,
        pendingPaymentsCount: pendingPayMap.get(s.id) ?? 0,
        teachers,
        latestEnrollmentAt: agg.latestEnrollmentAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return { data, meta: { page, limit, total, totalPages } };
  }

  /** Resolve a STUDENT by id (404 on bad uuid / missing / non-STUDENT). */
  private async assertStudent(studentId: string): Promise<StudentIdentity> {
    if (!UUID_RE.test(studentId)) {
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }
    const s = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        status: true,
        createdAt: true,
      },
    });
    if (!s) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    return { ...s, createdAt: s.createdAt.toISOString() };
  }

  private async resolveTeachers(studentId: string): Promise<StudentTeacherRef[]> {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      select: {
        chapter: {
          select: {
            teacher: {
              select: { id: true, fullName: true, teacherProfile: { select: { subject: true } } },
            },
          },
        },
      },
    });
    const map = new Map<string, StudentTeacherRef>();
    for (const e of enrollments) {
      const t = e.chapter.teacher;
      if (t && !map.has(t.id)) {
        map.set(t.id, { id: t.id, fullName: t.fullName, subject: t.teacherProfile?.subject ?? null });
      }
    }
    return [...map.values()];
  }

  private async averageScore(studentId: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(score::float / "totalPoints" * 100) AS avg
      FROM quiz_attempts
      WHERE "studentId" = ${studentId} AND score IS NOT NULL AND "totalPoints" > 0
    `;
    const avg = rows[0]?.avg;
    return avg != null ? Math.round(Number(avg) * 10) / 10 : 0;
  }

  async getDetail(studentId: string): Promise<AdminStudentDetailResponse> {
    const student = await this.assertStudent(studentId);
    const [
      enrollmentsCount,
      activeEnrollmentsCount,
      pendingEnrollmentsCount,
      quizAttemptsCount,
      completedLessonsCount,
      confirmedPayments,
      pendingPayments,
      failedPayments,
      teachers,
      averageScore,
    ] = await Promise.all([
      prisma.enrollment.count({ where: { studentId } }),
      prisma.enrollment.count({ where: { studentId, status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { studentId, status: "PAYMENT_PENDING" } }),
      prisma.quizAttempt.count({ where: { studentId } }),
      prisma.lessonProgress.count({ where: { studentId, completed: true } }),
      prisma.paymentTransaction.count({ where: { studentId, status: "SUCCESS" } }),
      prisma.paymentTransaction.count({ where: { studentId, status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { studentId, status: "FAILED" } }),
      this.resolveTeachers(studentId),
      this.averageScore(studentId),
    ]);

    return {
      student,
      summary: {
        enrollmentsCount,
        activeEnrollmentsCount,
        pendingEnrollmentsCount,
        teachersCount: teachers.length,
        quizAttemptsCount,
        averageScore,
        completedLessonsCount,
        confirmedPayments,
        pendingPayments,
        failedPayments,
      },
      teachers,
    };
  }

  async getEnrollments(
    studentId: string,
    query: StudentEnrollmentsQuery,
  ): Promise<Paginated<StudentEnrollmentItem>> {
    await this.assertStudent(studentId);
    const { page, limit, status } = query;
    const where = { studentId, ...(status ? { status } : {}) };

    const [total, rows] = await prisma.$transaction([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        select: {
          id: true,
          status: true,
          price: true,
          paymentMethod: true,
          createdAt: true,
          enrolledAt: true,
          chapter: {
            select: {
              id: true,
              name: true,
              stage: { select: { id: true, name: true } },
              teacher: { select: { id: true, fullName: true, teacherProfile: { select: { subject: true } } } },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: StudentEnrollmentItem[] = rows.map((e) => ({
      id: e.id,
      status: e.status,
      price: e.price,
      paymentMethod: e.paymentMethod,
      createdAt: e.createdAt.toISOString(),
      enrolledAt: e.enrolledAt.toISOString(),
      chapter: { id: e.chapter.id, name: e.chapter.name },
      stage: { id: e.chapter.stage.id, name: e.chapter.stage.name },
      teacher: {
        id: e.chapter.teacher.id,
        fullName: e.chapter.teacher.fullName,
        subject: e.chapter.teacher.teacherProfile?.subject ?? null,
      },
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPayments(studentId: string): Promise<StudentPaymentsResponse> {
    await this.assertStudent(studentId);
    const [rows, confirmed, pending, failed, confirmedAgg] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: { studentId },
        // Safe columns only — NEVER paymobOrderId / paymobTransactionId / rawCallback.
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          chapter: {
            select: {
              id: true,
              name: true,
              teacher: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.paymentTransaction.count({ where: { studentId, status: "SUCCESS" } }),
      prisma.paymentTransaction.count({ where: { studentId, status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { studentId, status: "FAILED" } }),
      prisma.paymentTransaction.aggregate({ where: { studentId, status: "SUCCESS" }, _sum: { amount: true } }),
    ]);

    return {
      data: rows.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        chapter: { id: p.chapter.id, name: p.chapter.name },
        teacher: { id: p.chapter.teacher.id, fullName: p.chapter.teacher.fullName },
      })),
      summary: {
        confirmed,
        pending,
        failed,
        confirmedTotal: Number(confirmedAgg._sum.amount ?? 0),
        currency: CURRENCY,
      },
    };
  }

  async getLearningSummary(studentId: string): Promise<StudentLearningSummary> {
    await this.assertStudent(studentId);
    const [
      quizAttemptsCount,
      completedQuizAttemptsCount,
      lessonProgressCount,
      completedLessonsCount,
      averageScore,
      lastAttempt,
      lastProgress,
    ] = await Promise.all([
      prisma.quizAttempt.count({ where: { studentId } }),
      prisma.quizAttempt.count({ where: { studentId, status: { in: ["COMPLETED", "GRADED"] } } }),
      prisma.lessonProgress.count({ where: { studentId } }),
      prisma.lessonProgress.count({ where: { studentId, completed: true } }),
      this.averageScore(studentId),
      prisma.quizAttempt.findFirst({ where: { studentId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      prisma.lessonProgress.findFirst({ where: { studentId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ]);

    const times = [lastAttempt?.updatedAt, lastProgress?.updatedAt].filter(
      (d): d is Date => d != null,
    );
    const lastActivityAt =
      times.length > 0
        ? new Date(Math.max(...times.map((d) => d.getTime()))).toISOString()
        : null;

    return {
      quizAttemptsCount,
      completedQuizAttemptsCount,
      averageScore,
      lessonProgressCount,
      completedLessonsCount,
      lastActivityAt,
    };
  }
}

export const adminStudentsService = new AdminStudentsService();
