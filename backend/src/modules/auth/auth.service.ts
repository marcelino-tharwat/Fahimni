import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OtpType, Role, Status } from "../../generated/prisma/index.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { userPublicFields } from "../users/user.types.js";
import { TokenService } from "./token.service.js";
import { hashRefreshToken } from "./auth.cookies.js";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.validation.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { ApiError } from "../../shared/types/common.types.js";
import { logger } from "../../config/logger.js";
import { uploadProofDocuments } from "./proof-documents.js";

export class AuthService {
  constructor(private readonly tokenService = new TokenService()) {}

  /** Generate tokens and create a refresh token session for the given user. */
  private async generateSession(userId: string) {
    return prisma.$transaction(async (tx) => {
      const { tokenVersion } = await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });

      await tx.refreshToken.deleteMany({ where: { userId } });

      const accessToken = this.tokenService.generateAccessToken(userId, tokenVersion);
      const refreshToken = this.tokenService.generateRefreshToken(userId, tokenVersion);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await tx.refreshToken.create({
        data: { token: hashRefreshToken(refreshToken), userId, expiresAt },
      });

      return { accessToken, refreshToken };
    });
  }

  public async loginUser(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      const error = new Error("Invalid email or password") as ApiError;
      error.status = 401;
      throw error;
    }

    // Verify the password BEFORE surfacing any account-state detail, so
    // teacher-state codes are only ever returned to the authenticated owner.
    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      const error = new Error("Invalid email or password") as ApiError;
      error.status = 401;
      throw error;
    }

    // Teacher lifecycle gating with specific codes (never the generic inactive
    // message). Checked before the generic INACTIVE guard because pending/rejected
    // teachers are INACTIVE by design.
    if (user.role === "OPERATION") {
      if (user.teacherApprovalState === "PENDING_REVIEW") {
        throw new AppError("حسابك قيد المراجعة من الإدارة", 403, "TEACHER_PENDING_REVIEW");
      }
      if (user.teacherApprovalState === "REJECTED") {
        throw new AppError("تم رفض طلب انضمامك", 403, "TEACHER_REJECTED");
      }
    }

    if (user.status === "INACTIVE" || user.status === "BANNED") {
      const error = new Error(
        "Account is inactive. Contact support.",
      ) as ApiError;
      error.status = 403;
      throw error;
    }

    const result = await this.generateSession(user.id);

    const { password: _, ...safeUser } = user;

    // For an approved teacher, tell the client whether payment is still required
    // so it can route to /teacher/plans vs the dashboard without a second call.
    let accessState: "ACTIVE_TEACHER" | "TEACHER_PAYMENT_REQUIRED" | undefined;
    if (user.role === "OPERATION" && user.teacherApprovalState === "APPROVED") {
      const activeSub = await prisma.teacherSubscription.findFirst({
        where: { teacherId: user.id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
        select: { id: true },
      });
      accessState = activeSub ? "ACTIVE_TEACHER" : "TEACHER_PAYMENT_REQUIRED";
    }

    return { user: safeUser, accessState, ...result };
  }

  public async registerUser(
    input: RegisterInput,
    files: Express.Multer.File[] = [],
  ) {
    // Check mobile uniqueness
    const existingMobile = await prisma.user.findUnique({
      where: { mobile: input.mobile },
      select: { id: true },
    });

    if (existingMobile) {
      const error = new Error("Mobile number already registered") as ApiError;
      error.status = 409;
      throw error;
    }

    // Check email uniqueness (only when provided)
    if (input.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existingEmail) {
        const error = new Error("Email already registered") as ApiError;
        error.status = 409;
        throw error;
      }
    }

    // Hash password with salt rounds = 12 (both roles — no plaintext is stored).
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Teacher registration follows the pending-review flow (no immediate access):
    // creates an INACTIVE OPERATION user in PENDING_REVIEW + a linked PENDING
    // request. It intentionally returns NO tokens.
    if (input.role === "OPERATION") {
      return this.registerTeacherPending(input, hashedPassword, files);
    }

    // Student registration (unchanged): active account + StudentProfile + tokens.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email,
          password: hashedPassword,
          role: Role.STUDENT,
          status: Status.ACTIVE,
        },
        select: userPublicFields,
      });

      if (!input.stageId) {
        throw new AppError("Stage is required for student registration", 400);
      }
      await tx.studentProfile.create({
        data: { userId: created.id, stageId: input.stageId },
      });

      return created;
    });

    // Token version starts at 0 (schema default) for a brand-new user.
    const { tokenVersion } = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { tokenVersion: true },
    });

    const accessToken = this.tokenService.generateRegisterToken(
      user.id,
      user.role,
      tokenVersion,
    );

    const refreshToken = this.tokenService.generateRefreshToken(user.id, tokenVersion);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: hashRefreshToken(refreshToken), userId: user.id, expiresAt },
    });

    return { pending: false as const, user, accessToken, refreshToken };
  }

  /** TR-YYYY-NNNNNN public reference with retry-on-collision (unique column is the guard). */
  private async generatePublicReference(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 6; attempt++) {
      const seq = String(100000 + crypto.randomInt(0, 900000));
      const ref = `TR-${year}-${seq}`;
      const exists = await prisma.teacherRegistrationRequest.findUnique({
        where: { publicReference: ref },
        select: { id: true },
      });
      if (!exists) return ref;
    }
    return `TR-${year}-${crypto.randomUUID().slice(0, 8)}`;
  }

  /**
   * Teacher registration → pending review. Creates an INACTIVE OPERATION user in
   * PENDING_REVIEW (login is blocked by the existing INACTIVE check, so no teacher
   * endpoint is reachable) plus a linked PENDING TeacherRegistrationRequest. No
   * random password is generated (the teacher's own password is hashed here) and
   * NO tokens are issued.
   */
  private async registerTeacherPending(
    input: RegisterInput,
    hashedPassword: string,
    files: Express.Multer.File[] = [],
  ) {
    // Reject if a legacy public request is already pending for this email/mobile.
    const pendingRequest = await prisma.teacherRegistrationRequest.findFirst({
      where: {
        status: "PENDING",
        OR: [{ email: input.email }, { mobile: input.mobile }],
      },
      select: { id: true },
    });
    if (pendingRequest) {
      throw new AppError(
        "لديك طلب قيد المراجعة بالفعل",
        409,
        "DUPLICATE_PENDING_REQUEST",
      );
    }

    const publicReference = await this.generatePublicReference();

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email,
          password: hashedPassword,
          role: Role.OPERATION,
          status: Status.INACTIVE,
          teacherApprovalState: "PENDING_REVIEW",
        },
        select: userPublicFields,
      });

      await tx.teacherProfile.create({
        data: {
          userId: created.id,
          subject: input.subject ?? null,
          bio: input.bio ?? null,
        },
      });

      const request = await tx.teacherRegistrationRequest.create({
        data: {
          publicReference,
          fullName: input.fullName,
          email: input.email,
          mobile: input.mobile,
          subject: input.subject ?? null,
          bio: input.bio ?? null,
          status: "PENDING",
          proofDocuments: [],
          userId: created.id,
        },
        select: { id: true },
      });

      return { created, requestId: request.id };
    });

    // Upload proof documents (if any) after the request exists, then attach their
    // metadata. Registration is already committed, so an upload hiccup only means
    // documents render as UNAVAILABLE — it never fails the registration.
    if (files.length > 0) {
      try {
        const docs = await uploadProofDocuments(user.requestId, files);
        await prisma.teacherRegistrationRequest.update({
          where: { id: user.requestId },
          data: { proofDocuments: JSON.parse(JSON.stringify(docs)) },
        });
      } catch (err) {
        logger.warn("teacher_register_proof_attach_failed", {
          requestId: user.requestId,
          errorName: err instanceof Error ? err.name : "UnknownError",
        });
      }
    }

    return { pending: true as const, user: user.created };
  }

  public async forgotPassword(input: ForgotPasswordInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      const error = new Error("User not found") as ApiError;
      error.status = 404;
      throw error;
    }

    // 2. Rate limit: max 3 OTP requests per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtpCount = await prisma.otp.count({
      where: {
        userId: user.id,
        type: OtpType.PASSWORD_RESET,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentOtpCount >= 3) {
      const error = new Error(
        "Too many OTP requests. Try again in an hour",
      ) as ApiError;
      error.status = 429;
      throw error;
    }

    // 3. Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 4. Hash OTP (salt rounds = 10 for speed, not stored password)
    const hashedOtp = await bcrypt.hash(otp, 10);

    // 5. Store hashed OTP with 5-minute expiry
    await prisma.otp.create({
      data: {
        code: hashedOtp,
        type: OtpType.PASSWORD_RESET,
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // 6. MVP: console.log — SMS/email integration in v2
    console.log(`[OTP] ${input.email}: ${otp}`);

    return { message: "OTP sent successfully" };
  }

  public async verifyOtp(input: VerifyOtpInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      const error = new Error("User not found") as ApiError;
      error.status = 404;
      throw error;
    }

    const storedOtp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        type: OtpType.PASSWORD_RESET,
        usedAt: null,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!storedOtp) {
      const error = new Error("OTP has expired") as ApiError;
      error.status = 410;
      throw error;
    }

    const isValid = await bcrypt.compare(input.otp, storedOtp.code);
    if (!isValid) {
      const error = new Error("Invalid OTP code") as ApiError;
      error.status = 400;
      throw error;
    }

    await prisma.otp.update({
      where: { id: storedOtp.id },
      data: { verifiedAt: new Date() },
    });

    return { message: "OTP verified successfully" };
  }

  public async resetPassword(input: ResetPasswordInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      const error = new Error("User not found") as ApiError;
      error.status = 404;
      throw error;
    }

    // 2. Find the verified, unused, non-expired PASSWORD_RESET OTP
    const storedOtp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        type: OtpType.PASSWORD_RESET,
        verifiedAt: { not: null },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!storedOtp) {
      const error = new Error("Please verify your OTP first") as ApiError;
      error.status = 400;
      throw error;
    }

    // 4. Atomic transaction: update password + mark OTP as used
    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.otp.update({
        where: { id: storedOtp.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: "Password reset successful" };
  }

  public async refreshAccessToken(incomingRefreshToken: string) {
    // 1. Verify signature/expiry of the refresh JWT (defense in depth).
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(
        incomingRefreshToken,
        env.JWT_REFRESH_SECRET,
      ) as jwt.JwtPayload;
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }
    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!userId) throw new AppError("Invalid refresh token", 401);

    // 2. Extract and validate tokenVersion BEFORE any rotation.
    //    If another login has superseded this session, reject immediately.
    const payloadVersion = typeof payload.ver === "number" ? payload.ver : undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, mobile: true,
        role: true, status: true, createdAt: true, updatedAt: true,
        tokenVersion: true,
      },
    });
    if (!user) {
      throw new AppError("Invalid refresh token", 401);
    }
    if (payloadVersion !== undefined && user.tokenVersion !== payloadVersion) {
      throw new AppError("Session superseded by new login", 401);
    }
    if (user.status === "INACTIVE" || user.status === "BANNED") {
      const error = new Error("Account is inactive. Contact support.") as ApiError;
      error.status = 403;
      throw error;
    }

    // 3. Rotate atomically IN PLACE — preserves the row id and createdAt so the
    //    STORY-66 last-login proxy keeps reflecting the original login, not each
    //    refresh. A replayed/already-rotated/expired token matches zero rows, so
    //    concurrent reuse yields exactly one valid successor.
    const oldHash = hashRefreshToken(incomingRefreshToken);
    const newRefreshToken = this.tokenService.generateRefreshToken(userId, user.tokenVersion);
    const newHash = hashRefreshToken(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const rotated = await prisma.refreshToken.updateMany({
      where: { token: oldHash, userId, expiresAt: { gt: new Date() } },
      data: { token: newHash, expiresAt },
    });
    if (rotated.count !== 1) {
      throw new AppError("Invalid refresh token", 401);
    }

    const newAccessToken = this.tokenService.generateAccessToken(userId, user.tokenVersion);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
  }

  /**
   * Revoke the refresh session for the supplied raw refresh token. Idempotent:
   * a missing/invalid/already-revoked token is a no-op (never throws), so logout
   * always succeeds and clears cookies.
   */
  public async logout(incomingRefreshToken: string | undefined): Promise<void> {
    if (!incomingRefreshToken) return;
    await prisma.refreshToken.deleteMany({
      where: { token: hashRefreshToken(incomingRefreshToken) },
    });
  }

  public async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userPublicFields,
    });

    if (!user) {
      const error = new Error("User not found") as ApiError;
      error.status = 404;
      throw error;
    }

    return user;
  }

  public async googleAuth(credential: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError("Google sign-in is not configured", 501);
    }

    // Verify the access token by calling Google's userinfo endpoint
    let userInfo: { email?: string; name?: string; sub?: string };
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${credential}`,
      );
      userInfo = await response.json();
      if (!response.ok || !userInfo.email) {
        throw new AppError("Invalid Google access token", 401);
      }
    } catch {
      // Fallback: try userinfo endpoint which requires a valid token
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${credential}` } },
      );
      if (!response.ok) {
        throw new AppError("Invalid Google access token", 401);
      }
      userInfo = await response.json();
    }

    if (!userInfo.email) {
      throw new AppError("Failed to get email from Google", 400);
    }

    const email = userInfo.email.toLowerCase();
    const fullName = userInfo.name ?? email.split("@")[0]!;
    const googleSub = userInfo.sub ?? email;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === "INACTIVE" || existing.status === "BANNED") {
        throw new AppError("Account is inactive. Contact support.", 403);
      }
      const result = await this.generateSession(existing.id);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: existing.id },
        select: userPublicFields,
      });
      return { user, ...result };
    }

    // Create new user via Google
    const mobile = `010${crypto.createHash("sha256").update(googleSub).digest("hex").slice(0, 8)}`;
    const randomPassword = crypto.randomUUID();

    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    const user = await prisma.$transaction(async (tx) => {
      const stage = await tx.stage.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!stage) {
        throw new AppError("No stages available. Contact support.", 500);
      }

      const created = await tx.user.create({
        data: {
          fullName,
          email,
          mobile,
          password: hashedPassword,
          role: Role.STUDENT,
          status: Status.ACTIVE,
        },
        select: userPublicFields,
      });

      await tx.studentProfile.create({
        data: { userId: created.id, stageId: stage.id },
      });

      return created;
    });

    const result = await this.generateSession(user.id);
    return { user, ...result };
  }

  public async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      const error = new Error("User not found") as ApiError;
      error.status = 404;
      throw error;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      input.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      const error = new Error("Current password is incorrect") as ApiError;
      error.status = 401;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: "Password changed successfully" };
  }
}
