import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { logAdminStageOverride } from "../students/student-stage-change.service.js";
import type {
  AdminUserListItem,
  AdminUserDetailResponse,
  AdminUserMutationResponse,
  Paginated,
  UserIdentity,
  StudentProfileRef,
  TeacherProfileRef,
  AuditLogRef,
} from "./admin-users.types.js";
import type {
  ListUsersQuery,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminChangeStatusInput,
  AdminChangeRoleInput,
  AdminResetPasswordInput,
} from "./admin-users.validation.js";

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

const mutationUserSelect = {
  id: true,
  fullName: true,
  email: true,
  mobile: true,
  role: true,
  status: true,
  teacherApprovalState: true,
  createdAt: true,
  updatedAt: true,
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

  async getUser(userId: string): Promise<{
    id: string;
    fullName: string;
    email: string | null;
    mobile: string;
    role: "ADMIN" | "STUDENT" | "OPERATION";
    status: "ACTIVE" | "INACTIVE" | "BANNED";
    teacherApprovalState: "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    if (!UUID_RE.test(userId)) return null;
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        status: true,
        teacherApprovalState: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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
        ? prisma.stage.count({ where: { chapters: { some: { teacherId: userId } } } })
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

  // ───────────────────────────────────────────────────────────────────────────────
  // CREATE USER (admin)
  // ───────────────────────────────────────────────────────────────────────────────

  async createUser(
    input: AdminCreateUserInput,
    actorId: string,
  ): Promise<AdminUserMutationResponse> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { mobile: input.mobile }],
      },
    });
    if (existing) {
      throw new AppError(
        "Email or mobile number already exists",
        409,
        "DUPLICATE_EMAIL_OR_MOBILE",
      );
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    return prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          mobile: input.mobile,
          password: hashedPassword,
          role: input.role,
          status: input.status,
          teacherApprovalState: input.teacherApprovalState,
          // Admin-created accounts (any role) are a trusted path, not a
          // self-submitted email — always pre-verified, set explicitly rather
          // than relying on the schema default.
          emailVerified: true,
        },
        select: mutationUserSelect,
      });

      // Create profile based on role
      if (input.studentProfile?.stageId) {
        await tx.studentProfile.upsert({
          where: { userId: created.id },
          update: { stageId: input.studentProfile.stageId },
          create: {
            userId: created.id,
            stageId: input.studentProfile.stageId,
          },
        });
      }

      if (input.teacherProfile) {
        const upd: Record<string, string> = {};
        if (input.teacherProfile.subject !== undefined) upd.subject = input.teacherProfile.subject;
        if (input.teacherProfile.bio !== undefined) upd.bio = input.teacherProfile.bio;
        if (Object.keys(upd).length > 0) {
          await tx.teacherProfile.upsert({
            where: { userId: created.id },
            update: upd,
            create: { userId: created.id, ...upd },
          });
        } else {
          await tx.teacherProfile.upsert({
            where: { userId: created.id },
            update: {},
            create: { userId: created.id },
          });
        }
      }

      await auditLogService.record(
        {
          action: "ADMIN_USER_CREATED",
          resourceType: "User",
          resourceId: created.id,
          actorId,
          actorType: "ADMIN",
          details: {
            role: created.role,
            status: created.status,
            email: created.email,
          },
        },
        tx,
      );

      return this.toMutationResponse(created);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // EDIT USER
  // ───────────────────────────────────────────────────────────────────────────────

  async updateUser(
    userId: string,
    input: AdminUpdateUserInput,
    actorId: string,
  ): Promise<AdminUserMutationResponse> {
    const user = await this.assertUser(userId);

    if (input.email || input.mobile) {
      const conditions: Prisma.UserWhereInput[] = [];
      if (input.email) conditions.push({ email: input.email });
      if (input.mobile) conditions.push({ mobile: input.mobile });
      const existing = await prisma.user.findFirst({
        where: { OR: conditions, NOT: { id: userId } },
      });
      if (existing) {
        throw new AppError(
          "Email or mobile number already exists",
          409,
          "DUPLICATE_EMAIL_OR_MOBILE",
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};
      if (input.fullName !== undefined) updateData.fullName = input.fullName;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.mobile !== undefined) updateData.mobile = input.mobile;

      const updated = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: mutationUserSelect,
      });

      if (input.studentProfile !== undefined && user.profiles.student && input.studentProfile.stageId) {
        const newStageId = input.studentProfile.stageId;
        // Fetch old stageId before upsert for logging
        const existingProfile = await tx.studentProfile.findUnique({
          where: { userId },
          select: { stageId: true },
        });
        const oldStageId = existingProfile?.stageId;
        await tx.studentProfile.upsert({
          where: { userId },
          update: { stageId: newStageId },
          create: { userId, stageId: newStageId },
        });
        // Log admin stage override separately from student self-changes
        if (oldStageId && oldStageId !== newStageId) {
          await logAdminStageOverride(userId, oldStageId, newStageId, actorId);
        }
      }

      if (input.teacherProfile !== undefined && user.profiles.teacher) {
        const upd: Record<string, string | undefined | null> = {};
        if (input.teacherProfile.subject !== undefined) upd.subject = input.teacherProfile.subject;
        if (input.teacherProfile.bio !== undefined) upd.bio = input.teacherProfile.bio;
        if (input.teacherProfile.photoUrl !== undefined) upd.photoUrl = input.teacherProfile.photoUrl;
        if (input.teacherProfile.logoUrl !== undefined) upd.logoUrl = input.teacherProfile.logoUrl;
        await tx.teacherProfile.upsert({
          where: { userId },
          update: upd,
          create: { userId },
        });
      }

      await auditLogService.record(
        {
          action: "ADMIN_USER_UPDATED",
          resourceType: "User",
          resourceId: userId,
          actorId,
          actorType: "ADMIN",
          details: {
            updatedFields: Object.keys(input),
          },
        },
        tx,
      );

      return this.toMutationResponse(updated);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // STATUS CHANGE (ban / unban / activate / deactivate)
  // ───────────────────────────────────────────────────────────────────────────────

  async changeStatus(
    userId: string,
    input: AdminChangeStatusInput,
    actorId: string,
  ): Promise<AdminUserMutationResponse & { previousStatus: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Check last-active-admin before self-check so the user
    // gets 409 (LAST_ACTIVE_ADMIN) instead of 403 (SELF_STATUS_CHANGE)
    // when they are the last active admin trying to deactivate themselves.
    if (input.status === "BANNED" || input.status === "INACTIVE") {
      if (user.role === "ADMIN") {
        const activeAdminCount = await prisma.user.count({
          where: { role: "ADMIN", status: "ACTIVE" },
        });
        if (activeAdminCount <= 1) {
          throw new AppError(
            "Cannot deactivate or ban the last active admin",
            409,
            "LAST_ACTIVE_ADMIN",
          );
        }
      }
    }

    if (userId === actorId) {
      throw new AppError(
        "Cannot change your own status",
        403,
        "SELF_STATUS_CHANGE",
      );
    }

    const previousStatus = user.status;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: input.status },
        select: mutationUserSelect,
      });

      let auditAction:
        | "ADMIN_USER_BANNED"
        | "ADMIN_USER_UNBANNED"
        | "ADMIN_USER_ACTIVATED"
        | "ADMIN_USER_DEACTIVATED";

      if (input.status === "BANNED") {
        auditAction = "ADMIN_USER_BANNED";
      } else if (input.status === "ACTIVE" && previousStatus === "BANNED") {
        auditAction = "ADMIN_USER_UNBANNED";
      } else if (input.status === "ACTIVE") {
        auditAction = "ADMIN_USER_ACTIVATED";
      } else if (input.status === "INACTIVE") {
        auditAction = "ADMIN_USER_DEACTIVATED";
      } else {
        auditAction = "ADMIN_USER_DEACTIVATED";
      }

      await auditLogService.record(
        {
          action: auditAction,
          resourceType: "User",
          resourceId: userId,
          actorId,
          actorType: "ADMIN",
          details: {
            previousStatus,
            newStatus: input.status,
            reason: input.reason ?? null,
          },
        },
        tx,
      );

      return {
        ...this.toMutationResponse(updated),
        previousStatus,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // ROLE CHANGE with dependency safety checks
  // ───────────────────────────────────────────────────────────────────────────────

  async changeRole(
    userId: string,
    input: AdminChangeRoleInput,
    actorId: string,
  ): Promise<AdminUserMutationResponse & { previousRole: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        teacherApprovalState: true,
      },
    });
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Prevent demoting last active ADMIN (check before self-check so the
    // last active admin gets 409 LAST_ACTIVE_ADMIN instead of 403 SELF_ROLE_CHANGE)
    if (user.role === "ADMIN" && input.role !== "ADMIN") {
      const activeAdminCount = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      if (activeAdminCount <= 1) {
        throw new AppError(
          "Cannot demote the last active admin",
          409,
          "LAST_ACTIVE_ADMIN",
        );
      }
    }

    if (userId === actorId) {
      throw new AppError(
        "Cannot change your own role",
        403,
        "SELF_ROLE_CHANGE",
      );
    }

    const previousRole = user.role;

    // ── Dependency checks ──────────────────────────────────────────────────

    if (user.role === "OPERATION" && input.role !== "OPERATION") {
      await this.assertNoTeacherDependencies(userId);
    }

    if (user.role === "STUDENT" && input.role !== "STUDENT") {
      await this.assertNoStudentDependencies(userId);
    }

    // ── Role change ────────────────────────────────────────────────────────

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {
        role: input.role,
      };

      // Handle teacherApprovalState transitions
      if (input.role === "OPERATION" && previousRole !== "OPERATION") {
        updateData.teacherApprovalState = "APPROVED";
      } else if (
        input.role !== "OPERATION" &&
        previousRole === "OPERATION"
      ) {
        updateData.teacherApprovalState = "NONE";
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: mutationUserSelect,
      });

      // Ensure correct profile exists for new role
      if (input.role === "STUDENT" && !updated.teacherApprovalState) {
        const defaultStage = await prisma.stage.findFirst({ select: { id: true } });
        if (defaultStage) {
          await tx.studentProfile.upsert({
            where: { userId },
            update: { stageId: defaultStage.id },
            create: { userId, stageId: defaultStage.id },
          });
        }
      }

      if (input.role === "OPERATION") {
        await tx.teacherProfile.upsert({
          where: { userId },
          update: {},
          create: { userId },
        });
      }

      await auditLogService.record(
        {
          action: "ADMIN_USER_ROLE_CHANGED",
          resourceType: "User",
          resourceId: userId,
          actorId,
          actorType: "ADMIN",
          details: {
            previousRole,
            newRole: input.role,
            reason: input.reason ?? null,
          },
        },
        tx,
      );

      return {
        ...this.toMutationResponse(updated),
        previousRole,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // RESET PASSWORD (admin)
  // ───────────────────────────────────────────────────────────────────────────────

  async resetPassword(
    userId: string,
    input: AdminResetPasswordInput,
    actorId: string,
  ): Promise<AdminUserMutationResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (userId === actorId) {
      throw new AppError(
        "Cannot reset your own password through admin panel",
        403,
        "SELF_PASSWORD_RESET",
      );
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    return prisma.$transaction(async (tx) => {
      if (input.forceLogout) {
        await tx.user.update({
          where: { id: userId },
          data: {
            password: hashedPassword,
            tokenVersion: { increment: 1 },
          },
        });
        await tx.refreshToken.deleteMany({ where: { userId } });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        });
      }

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: mutationUserSelect,
      });

      await auditLogService.record(
        {
          action: "ADMIN_USER_PASSWORD_CHANGED",
          resourceType: "User",
          resourceId: userId,
          actorId,
          actorType: "ADMIN",
          details: {
            forceLogout: input.forceLogout,
            reason: input.reason,
          },
        },
        tx,
      );

      return this.toMutationResponse(updated);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // TEACHER DEPENDENCY CHECKS
  // ───────────────────────────────────────────────────────────────────────────────

  private async assertNoTeacherDependencies(
    userId: string,
  ): Promise<void> {
    const [
      chaptersUnderTeacherCount,
      lessonsUnderTeacherCount,
      quizzesOwnedCount,
      enrollmentsUnderTeacher,
      paymentsUnderTeacher,
      subscriptionsCount,
      subscriptionPaymentsCount,
      subscriptionRequestsCount,
      aiUsageEventsCount,
      teacherRegistrationRequestCount,
      materialsCount,
    ] = await Promise.all([
      prisma.chapter.count({ where: { teacherId: userId } }),
      prisma.lesson.count({
        where: { chapter: { teacherId: userId } },
      }),
      prisma.quiz.count({ where: { createdBy: userId } }),
      prisma.enrollment.count({
        where: { chapter: { teacherId: userId } },
      }),
      prisma.paymentTransaction.count({
        where: { chapter: { teacherId: userId } },
      }),
      prisma.teacherSubscription.count({
        where: { teacherId: userId },
      }),
      prisma.teacherSubscriptionPayment.count({
        where: { teacherId: userId },
      }),
      prisma.teacherSubscriptionRequest.count({
        where: { teacherId: userId },
      }),
      prisma.teacherAiUsageEvent.count({
        where: { teacherId: userId },
      }),
      prisma.teacherRegistrationRequest.count({
        where: { userId },
      }),
      prisma.lessonMaterial.count({
        where: { lesson: { chapter: { teacherId: userId } } },
      }),
    ]);

    const hasDependencies =
      chaptersUnderTeacherCount > 0 ||
      lessonsUnderTeacherCount > 0 ||
      quizzesOwnedCount > 0 ||
      enrollmentsUnderTeacher > 0 ||
      paymentsUnderTeacher > 0 ||
      subscriptionsCount > 0 ||
      subscriptionPaymentsCount > 0 ||
      subscriptionRequestsCount > 0 ||
      aiUsageEventsCount > 0 ||
      teacherRegistrationRequestCount > 0 ||
      materialsCount > 0;

    if (hasDependencies) {
      throw new AppError(
        "لا يمكن تغيير دور المدرس لوجود كورسات أو دروس أو محتوى أو اشتراكات مرتبطة به.",
        409,
        "ROLE_CHANGE_BLOCKED_HAS_TEACHER_DATA",
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // STUDENT DEPENDENCY CHECKS
  // ───────────────────────────────────────────────────────────────────────────────

  private async assertNoStudentDependencies(
    userId: string,
  ): Promise<void> {
    const [
      activeEnrollmentsCount,
      allEnrollmentsCount,
      paymentTransactionsCount,
      quizAttemptsCount,
      lessonProgressCount,
      promoCodeUsageCount,
    ] = await Promise.all([
      prisma.enrollment.count({
        where: { studentId: userId, status: "ACTIVE" },
      }),
      prisma.enrollment.count({ where: { studentId: userId } }),
      prisma.paymentTransaction.count({
        where: { studentId: userId },
      }),
      prisma.quizAttempt.count({ where: { studentId: userId } }),
      prisma.lessonProgress.count({
        where: { studentId: userId },
      }),
      prisma.promoCode.count({
        where: { usedByStudentId: userId },
      }),
    ]);

    const hasDependencies =
      activeEnrollmentsCount > 0 ||
      allEnrollmentsCount > 0 ||
      paymentTransactionsCount > 0 ||
      quizAttemptsCount > 0 ||
      lessonProgressCount > 0 ||
      promoCodeUsageCount > 0;

    if (hasDependencies) {
      throw new AppError(
        "لا يمكن تغيير دور الطالب لوجود اشتراكات أو كورسات أو تقدم تعليمي أو مدفوعات مرتبطة به.",
        409,
        "ROLE_CHANGE_BLOCKED_HAS_STUDENT_DATA",
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────────

  private toMutationResponse(
    u: {
      id: string;
      fullName: string;
      email: string | null;
      mobile: string;
      role: "ADMIN" | "STUDENT" | "OPERATION";
      status: "ACTIVE" | "INACTIVE" | "BANNED";
      teacherApprovalState: "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
      createdAt: Date;
      updatedAt: Date;
    },
  ): AdminUserMutationResponse {
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
    };
  }

  /**
   * Check if a user has any teacher-owned business data linked to their account.
   * Returns true if teacher data exists (role change should be blocked).
   */
  async checkTeacherDependencies(
    userId: string,
  ): Promise<{ hasDependencies: boolean; details?: Record<string, number> }> {
    const user = await this.getUser(userId);
    if (!user || user.role !== "OPERATION") {
      return { hasDependencies: false };
    }

    const [
      chaptersUnderTeacherCount,
      lessonsUnderTeacherCount,
      quizzesOwnedCount,
      enrollmentsUnderTeacher,
      paymentsUnderTeacher,
      subscriptionsCount,
      subscriptionPaymentsCount,
      subscriptionRequestsCount,
      aiUsageEventsCount,
      materialsCount,
    ] = await Promise.all([
      prisma.chapter.count({ where: { teacherId: userId } }),
      prisma.lesson.count({ where: { chapter: { teacherId: userId } } }),
      prisma.quiz.count({ where: { createdBy: userId } }),
      prisma.enrollment.count({ where: { chapter: { teacherId: userId } } }),
      prisma.paymentTransaction.count({ where: { chapter: { teacherId: userId } } }),
      prisma.teacherSubscription.count({ where: { teacherId: userId } }),
      prisma.teacherSubscriptionPayment.count({ where: { teacherId: userId } }),
      prisma.teacherSubscriptionRequest.count({ where: { teacherId: userId } }),
      prisma.teacherAiUsageEvent.count({ where: { teacherId: userId } }),
      prisma.lessonMaterial.count({ where: { lesson: { chapter: { teacherId: userId } } } }),
    ]);

    const details = {
      stagesCount: 0, // Stages are admin-owned; no longer scoped to teachers
      chaptersCount: chaptersUnderTeacherCount,
      lessonsCount: lessonsUnderTeacherCount,
      quizzesCount: quizzesOwnedCount,
      enrollmentsCount: enrollmentsUnderTeacher,
      paymentsCount: paymentsUnderTeacher,
      subscriptionsCount,
      subscriptionPaymentsCount,
      subscriptionRequestsCount,
      aiUsageEventsCount,
      materialsCount,
    };

    const hasDependencies = Object.values(details).some((v) => v > 0);
    return { hasDependencies, details };
  }

  /**
   * Check if a user has any student-owned learning/payment data linked to their account.
   * Returns true if student data exists (role change should be blocked).
   */
  async checkStudentDependencies(
    userId: string,
  ): Promise<{ hasDependencies: boolean; details?: Record<string, number> }> {
    const user = await this.getUser(userId);
    if (!user || user.role !== "STUDENT") {
      return { hasDependencies: false };
    }

    const [
      allEnrollmentsCount,
      activeEnrollmentsCount,
      paymentTransactionsCount,
      quizAttemptsCount,
      lessonProgressCount,
      promoCodeUsageCount,
    ] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: userId } }),
      prisma.enrollment.count({ where: { studentId: userId, status: "ACTIVE" } }),
      prisma.paymentTransaction.count({ where: { studentId: userId } }),
      prisma.quizAttempt.count({ where: { studentId: userId } }),
      prisma.lessonProgress.count({ where: { studentId: userId } }),
      prisma.promoCode.count({ where: { usedByStudentId: userId } }),
    ]);

    const details = {
      allEnrollmentsCount,
      activeEnrollmentsCount,
      paymentTransactionsCount,
      quizAttemptsCount,
      lessonProgressCount,
      promoCodeUsageCount,
    };

    const hasDependencies = Object.values(details).some((v) => v > 0);
    return { hasDependencies, details };
  }
}

export const adminUsersService = new AdminUsersService();
