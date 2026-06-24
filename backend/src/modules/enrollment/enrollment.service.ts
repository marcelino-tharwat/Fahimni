import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import {
  enrollmentPublicFields,
  enrollmentListFields,
} from "./enrollment.types.js";
import type {
  EnrollmentResponseDTO,
  EnrollmentListItemDTO,
} from "./enrollment.types.js";
import type { CreateEnrollmentInput } from "./enrollment.validation.js";

/** Default access window granted on enrollment when the chapter has no explicit validity setting. */
const DEFAULT_ENROLLMENT_DAYS = 30;

export class EnrollmentService {
  /**
   * Ensures the given teacher owns the chapter (via chapter → stage → teacherId).
   * Used to scope OPERATION (teacher) access to their own content. ADMIN callers
   * should skip this check entirely.
   */
  private async verifyTeacherOwnership(
    chapterId: string,
    teacherId: string,
  ): Promise<void> {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { stage: { select: { teacherId: true } } },
    });

    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    if (chapter.stage.teacherId !== teacherId) {
      throw new AppError(
        "You do not have access to this chapter's enrollments",
        403,
      );
    }
  }

  public async createEnrollment(
    studentId: string,
    data: CreateEnrollmentInput,
  ): Promise<EnrollmentResponseDTO> {
    const chapter = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        stage: { select: { teacherId: true } },
      },
    });

    if (!chapter || chapter.deletedAt) {
      throw new AppError("Chapter not found", 404);
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_chapterId: { studentId, chapterId: data.chapterId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppError("You are already enrolled in this chapter", 409);
    }

    const startedAt = new Date();
    // No per-chapter validity setting exists on the Chapter model, so fall back
    // to a fixed access window from the moment of enrollment.
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_ENROLLMENT_DAYS);

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        chapterId: data.chapterId,
        price: data.price,
        paymentMethod: data.paymentMethod,
        promoCodeId: data.promoCodeId ?? null,
        enrolledMonth: startedAt.getMonth() + 1,
        enrolledYear: startedAt.getFullYear(),
        startedAt,
        expiresAt,
      },
      select: enrollmentPublicFields,
    });

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { fullName: true },
    });

    await auditLogService.record({
      action: "STUDENT_ENROLLED",
      resourceType: "ENROLLMENT",
      resourceId: enrollment.id,
      actorId: studentId,
      actorType: "STUDENT",
      actorName: student?.fullName ?? null,
      scopeTeacherId: chapter.stage.teacherId,
      details: {
        chapterId: chapter.id,
        chapterName: chapter.name,
        price: data.price,
        paymentMethod: data.paymentMethod,
      },
    });

    // TODO: No ActivityLog / StudentHistory model exists in the Prisma schema
    // yet. When a student-facing history model is added, create a history entry
    // for this enrollment here.

    return this.toResponseDTO(enrollment);
  }

  /** SCRUM-506: deactivate an active enrollment (operations/admin action). */
  public async deactivateEnrollment(
    enrollmentId: string,
    actorId: string,
    actorRole: string,
  ): Promise<EnrollmentResponseDTO> {
    const existing = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        status: true,
        studentId: true,
        chapterId: true,
        chapter: { select: { stage: { select: { teacherId: true } } } },
      },
    });

    if (!existing) {
      throw new AppError("Enrollment not found", 404);
    }

    // OPERATION (teacher) may only act on enrollments for chapters they own;
    // ADMIN has unrestricted access. Checked before the status check so a
    // teacher cannot probe the state of an enrollment they don't own.
    if (actorRole === "OPERATION") {
      await this.verifyTeacherOwnership(existing.chapterId, actorId);
    }

    if (existing.status !== "ACTIVE") {
      throw new AppError("Enrollment is already deactivated or expired", 400);
    }

    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "DEACTIVATED" },
      select: enrollmentPublicFields,
    });

    await auditLogService.record({
      action: "STUDENT_UNENROLLED",
      resourceType: "ENROLLMENT",
      resourceId: enrollmentId,
      actorId,
      actorType: actorRole === "OPERATION" ? "TEACHER" : "ADMIN",
      scopeTeacherId: existing.chapter.stage.teacherId,
      details: {
        field: "status",
        oldValue: "ACTIVE",
        newValue: "DEACTIVATED",
      },
    });

    return this.toResponseDTO(enrollment);
  }

  /** SCRUM-504: a student's own active enrollments, newest first. */
  public async getMyEnrollments(
    studentId: string,
  ): Promise<EnrollmentListItemDTO[]> {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "ACTIVE" },
      select: enrollmentListFields,
      orderBy: { createdAt: "desc" },
    });

    return enrollments.map((e) => this.toListItem(e));
  }

  /**
   * SCRUM-505: enrollments for a given student, newest first (operations/admin view).
   * ADMIN sees every enrollment; OPERATION (teacher) is scoped to enrollments for
   * chapters in their own stages via a `where` clause (filtered in the query, not
   * post-fetch).
   */
  public async getStudentEnrollments(
    studentId: string,
    actorId: string,
    actorRole: string,
  ): Promise<EnrollmentListItemDTO[]> {
    const where =
      actorRole === "OPERATION"
        ? { studentId, chapter: { stage: { teacherId: actorId } } }
        : { studentId };

    const enrollments = await prisma.enrollment.findMany({
      where,
      select: enrollmentListFields,
      orderBy: { createdAt: "desc" },
    });

    return enrollments.map((e) => this.toListItem(e));
  }

  /** Normalize Decimal prices to numbers for the single-enrollment response shape. */
  private toResponseDTO(
    enrollment: {
      price: unknown;
      chapter: { price: unknown };
    } & Record<string, unknown>,
  ): EnrollmentResponseDTO {
    return {
      ...enrollment,
      price: Number(enrollment.price),
      chapter: {
        ...enrollment.chapter,
        price:
          enrollment.chapter.price !== null
            ? Number(enrollment.chapter.price)
            : null,
      },
    } as unknown as EnrollmentResponseDTO;
  }

  /** Normalize Decimal prices to numbers for the list response shape. */
  private toListItem(
    enrollment: {
      price: unknown;
      chapter: { price: unknown };
    } & Record<string, unknown>,
  ): EnrollmentListItemDTO {
    return {
      ...enrollment,
      price: Number(enrollment.price),
      chapter: {
        ...enrollment.chapter,
        price:
          enrollment.chapter.price !== null
            ? Number(enrollment.chapter.price)
            : null,
      },
    } as unknown as EnrollmentListItemDTO;
  }
}
