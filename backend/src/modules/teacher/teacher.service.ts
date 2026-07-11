import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { userPublicFields } from "../users/user.types.js";
import { teacherPublicFields } from "./teacher.types.js";
import type { TeacherProfileResponseDTO } from "./teacher.types.js";
import type { UpdateTeacherProfileInput, ResubmitRequestInput } from "./teacher.validation.js";
import { AppError } from "../../shared/utils/AppError.js";
import { UploadService } from "../../shared/upload.service.js";
import { teacherPlanEntitlementService } from "../teacher-plans/teacher-plan-entitlement.service.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";

type TeacherProfileUpdateData = {
  subject?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  aiTutorDailyQueryLimit?: number;
};

const uploadService = new UploadService();

export interface ReviewStatusResponse {
  teacherApprovalState: "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  accessState: "TEACHER_PENDING_REVIEW" | "TEACHER_REJECTED" | "FREE_PLAN" | "PAID_PLAN";
  canAccessTeacherFeatures: boolean;
  request: {
    publicReference: string | null;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    rejectionMode: "EDIT_ALLOWED" | "FINAL_REJECTION" | null;
    canEditAndResubmit: boolean;
    fullName: string | null;
    email: string | null;
    mobile: string | null;
    subject: string | null;
    bio: string | null;
  } | null;
  message: string;
}

export class TeacherService {
  public async getReviewStatus(userId: string): Promise<ReviewStatusResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        teacherApprovalState: true,
        role: true,
      },
    });

    if (!user || user.role !== "OPERATION") {
      throw new AppError("Not authorized", 403);
    }

    const entitlement = await teacherPlanEntitlementService.resolve(userId);

    // Find the most recent linked registration request (safe data only — no
    // proof document paths, no reviewedBy details, no admin private data).
    const request = await prisma.teacherRegistrationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        publicReference: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        adminNotes: true,
        rejectionMode: true,
        fullName: true,
        email: true,
        mobile: true,
        subject: true,
        bio: true,
      },
    });

    const state = user.teacherApprovalState;

    const messages: Record<string, string> = {
      PENDING_REVIEW:
        "مرحبًا بك، تم استلام طلبك وهو الآن قيد المراجعة من الإدارة.",
      REJECTED:
        "نأسف، تم رفض طلبك. يمكنك التواصل مع الإدارة لمزيد من التفاصيل.",
      APPROVED:
        "تم قبول طلبك، يمكنك الآن استخدام المنصة.",
      NONE:
        "مرحبًا بك. يرجى إكمال طلب التسجيل كمدرس.",
    };

    const rmStr = request?.rejectionMode ? (request.rejectionMode as unknown as string) : null;
    const isEditAllowed = rmStr === "EDIT_ALLOWED";

    return {
      teacherApprovalState: state,
      accessState: entitlement.accessState as ReviewStatusResponse["accessState"],
      canAccessTeacherFeatures: entitlement.canAccessTeacherFeatures,
      request: request
        ? {
            publicReference: request.publicReference,
            status: request.status,
            submittedAt: request.createdAt.toISOString(),
            reviewedAt: request.reviewedAt?.toISOString() ?? null,
            rejectionReason: request.adminNotes ?? null,
            rejectionMode: (rmStr === "EDIT_ALLOWED" ? "EDIT_ALLOWED" : rmStr === "FINAL_REJECTION" ? "FINAL_REJECTION" : null) as "EDIT_ALLOWED" | "FINAL_REJECTION" | null,
            canEditAndResubmit: request.status === "REJECTED" && isEditAllowed,
            fullName: request.fullName,
            email: request.email,
            mobile: request.mobile,
            subject: request.subject,
            bio: request.bio,
          }
        : null,
      message: (messages[state] ?? messages.NONE) as string,
    };
  }

  public async resubmitRequest(userId: string, input: ResubmitRequestInput): Promise<{ publicReference: string; status: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, teacherApprovalState: true },
    });
    if (!user || user.role !== "OPERATION") {
      throw new AppError("Not authorized", 403);
    }

    const request = await prisma.teacherRegistrationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicReference: true,
        status: true,
        rejectionMode: true,
      },
    });

    if (!request) {
      throw new AppError("No registration request found", 404);
    }
    if (request.status !== "REJECTED" || request.rejectionMode !== "EDIT_ALLOWED") {
      throw new AppError("هذا الطلب مرفوض رفضًا نهائيًا ولا يمكن إعادة التقديم", 403, "REQUEST_REJECTION_FINAL");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.teacherRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: "PENDING",
          reviewedById: null,
          reviewedAt: null,
          adminNotes: null,
          rejectionMode: null,
          ...(input.fullName ? { fullName: input.fullName } : {}),
          ...(input.email ? { email: input.email } : {}),
          ...(input.mobile ? { mobile: input.mobile } : {}),
          ...(input.subject ? { subject: input.subject } : {}),
          ...(input.bio ? { bio: input.bio } : {}),
        },
        select: { publicReference: true, status: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { teacherApprovalState: "PENDING_REVIEW" },
      });

      await auditLogService.record(
        {
          action: "TEACHER_REQUEST_RESUBMITTED",
          resourceType: "TeacherRegistrationRequest",
          resourceId: request.id,
          actorId: userId,
          actorType: "TEACHER",
          details: { publicReference: req.publicReference },
        },
        tx,
      );

      return req;
    });

    return { publicReference: updated.publicReference, status: updated.status };
  }

  public async getProfile(userId: string): Promise<TeacherProfileResponseDTO> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    if (!profile) {
      throw new AppError("Teacher profile not found", 404);
    }

    return profile as unknown as TeacherProfileResponseDTO;
  }

  public async updateProfile(
    userId: string,
    input: UpdateTeacherProfileInput,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    // 1. Update User fields if provided (fullName, email, mobile live on User).
    const userData: Record<string, string> = {};
    if (input.fullName !== undefined && input.fullName !== "") {
      userData.fullName = input.fullName;
    }
    if (input.email !== undefined && input.email !== "") {
      userData.email = input.email;
    }
    if (input.mobile !== undefined && input.mobile !== "") {
      userData.mobile = input.mobile;
    }

    if (Object.keys(userData).length > 0) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: userData,
        });
      } catch (error) {
        // A unique-constraint violation (email or mobile already in use)
        // surfaces as Prisma error code P2002.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // `meta.target` lists the column(s) that violated the unique
          // constraint, so we can point the user at the right field.
          const target = (error.meta?.target as string[]) || [];
          if (target.includes("email")) {
            throw new AppError("This email is already registered", 409);
          }
          if (target.includes("mobile")) {
            throw new AppError("This mobile number is already registered", 409);
          }
          throw new AppError("This value is already registered", 409);
        }
        throw error;
      }
    }

    // 2. Update TeacherProfile fields (subject, bio, photoUrl, logoUrl).
    const teacherData = this.buildUpdateData(input);

    if (Object.keys(teacherData).length > 0) {
      await prisma.teacherProfile.update({
        where: { userId },
        data: teacherData,
      });
    }

    // 3. Return the full updated profile (including fresh user data).
    const updated = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  public async uploadPhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const photoUrl = await uploadService.uploadPhoto(file.buffer);

    const updated = await prisma.teacherProfile.update({
      where: { userId },
      data: { photoUrl },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  public async uploadLogo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const logoUrl = await uploadService.uploadLogo(file.buffer);

    const updated = await prisma.teacherProfile.update({
      where: { userId },
      data: { logoUrl },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  private buildUpdateData(
    input: UpdateTeacherProfileInput,
  ): TeacherProfileUpdateData {
    const data: TeacherProfileUpdateData = {};

    if (input.subject !== undefined) {
      data.subject = input.subject === "" ? null : input.subject;
    }
    if (input.bio !== undefined) {
      data.bio = input.bio === "" ? null : input.bio;
    }
    if (input.photoUrl !== undefined) {
      data.photoUrl = input.photoUrl === "" ? null : input.photoUrl;
    }
    if (input.logoUrl !== undefined) {
      data.logoUrl = input.logoUrl === "" ? null : input.logoUrl;
    }
    if (input.aiTutorDailyQueryLimit !== undefined) {
      data.aiTutorDailyQueryLimit = input.aiTutorDailyQueryLimit;
    }

    return data;
  }
}
