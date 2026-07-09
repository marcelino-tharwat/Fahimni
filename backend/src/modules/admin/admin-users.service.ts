import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import type {
  AdminUserListItem,
  AdminUserDetailResponse,
  Paginated,
  UserIdentity,
  StudentProfileRef,
  TeacherProfileRef,
  AuditLogRef,
} from "./admin-users.types.js";
import type { ListUsersQuery } from "./admin-users.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  mobile: true,
  role: true,
  status: true,
  teacherApprovalState: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: { select: { id: true } },
  teacherProfile: { select: { id: true } },
} as const;

export class AdminUsersService {
  private buildWhere(query: ListUsersQuery): Prisma.UserWhereInput {
    const { q, role, status, teacherApprovalState } = query;
    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (teacherApprovalState)
      where.teacherApprovalState = teacherApprovalState;
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
      ];
    }
    return where;
  }

  async listUsers(
    query: ListUsersQuery,
  ): Promise<Paginated<AdminUserListItem>> {
    const { page, limit, sortBy, sort } = query;
    const where = this.buildWhere(query);
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sort,
    };

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: AdminUserListItem[] = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      status: u.status,
      teacherApprovalState: u.teacherApprovalState,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      profiles: {
        student: u.studentProfile != null,
        teacher: u.teacherProfile != null,
      },
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async assertUser(userId: string): Promise<UserIdentity> {
    if (!UUID_RE.test(userId)) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...safeUserSelect,
      },
    });
    if (!u)
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      status: u.status,
      teacherApprovalState: u.teacherApprovalState,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      profiles: {
        student: u.studentProfile != null,
        teacher: u.teacherProfile != null,
      },
    };
  }

  async getDetail(userId: string): Promise<AdminUserDetailResponse> {
    const user = await this.assertUser(userId);

    const studentProfile: StudentProfileRef | null =
      user.profiles.student
        ? await prisma.studentProfile.findUnique({
            where: { userId },
            select: { id: true, stageId: true },
          })
        : null;

    const teacherProfile: TeacherProfileRef | null =
      user.profiles.teacher
        ? await prisma.teacherProfile.findUnique({
            where: { userId },
            select: { id: true, subject: true, photoUrl: true },
          })
        : null;

    const counts = await this.resolveCounts(userId, user.role);
    const recentAuditLogs = await this.resolveRecentAuditLogs(userId);

    return {
      user,
      studentProfile,
      teacherProfile,
      counts,
      recentAuditLogs,
    };
  }

  private async resolveCounts(
    userId: string,
    role: string,
  ): Promise<{
    enrollmentsCount: number;
    quizAttemptsCount: number;
    paymentTransactionsCount: number;
    teacherStagesCount: number;
    teacherSubscriptionsCount: number;
  }> {
    const [
      enrollmentsCount,
      quizAttemptsCount,
      paymentTransactionsCount,
      teacherStagesCount,
      teacherSubscriptionsCount,
    ] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: userId } }),
      prisma.quizAttempt.count({ where: { studentId: userId } }),
      prisma.paymentTransaction.count({
        where: { studentId: userId },
      }),
      role === "OPERATION"
        ? prisma.stage.count({ where: { teacherId: userId } })
        : Promise.resolve(0),
      role === "OPERATION"
        ? prisma.teacherSubscription.count({
            where: { teacherId: userId },
          })
        : Promise.resolve(0),
    ]);

    return {
      enrollmentsCount,
      quizAttemptsCount,
      paymentTransactionsCount,
      teacherStagesCount,
      teacherSubscriptionsCount,
    };
  }

  private async resolveRecentAuditLogs(
    userId: string,
  ): Promise<AuditLogRef[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          resourceType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return logs.map((l) => ({
        id: l.id,
        action: l.action,
        resourceType: l.resourceType,
        createdAt: l.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }
}

export const adminUsersService = new AdminUsersService();
