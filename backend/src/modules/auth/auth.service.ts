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
  UpdateLocaleInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from "./auth.validation.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { uploadProofDocuments } from "./proof-documents.js";
import { normalizeLocale, sendTransactionalEmail } from "../email/transactional-email.helpers.js";

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

  /**
   * Issues a raw email-verification token and stores only its SHA-256 hash
   * (as `Otp.code`, type EMAIL_VERIFICATION). Unlike the password-reset OTP
   * (bcrypt-hashed, looked up by email+code together), this token arrives as
   * a bare link with no known owner, so it must be looked up directly by
   * hash — SHA-256 is deterministic and indexable, bcrypt is not.
   */
  private async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.otp.create({
      data: {
        code: hashedToken,
        type: OtpType.EMAIL_VERIFICATION,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }

  public async loginUser(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    // Verify the password BEFORE surfacing any account-state detail, so
    // teacher-state codes are only ever returned to the authenticated owner.
    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    // ADMIN and OPERATION (teacher) accounts are exempt from the email-verification
    // gate regardless of the stored emailVerified value — role-based, not a
    // one-time registration-time default, so an account created any other way
    // later is still never blocked here. Teachers are gated on admin-approval
    // status instead (teacherApprovalState, checked below); only students go
    // through the email-verification flow.
    if (user.role !== "ADMIN" && user.role !== "OPERATION" && !user.emailVerified) {
      throw new AppError("Please verify your email before logging in.", 403, "EMAIL_NOT_VERIFIED");
    }

    // BANNED users are always blocked — no exceptions.
    if (user.status === "BANNED") {
      throw new AppError("Account is inactive. Contact support.", 403, "ACCOUNT_INACTIVE");
    }

    // Teacher lifecycle gating — pending/rejected teachers are allowed to login
    // in restricted mode (they can see their review-status page but cannot access
    // teacher features). Approved teachers proceed normally. Other INACTIVE
    // non-teacher users remain blocked.
    if (user.role === "OPERATION") {
      if (user.teacherApprovalState === "PENDING_REVIEW") {
        const result = await this.generateSession(user.id);
        const { password: _, ...safeUser } = user;
        return { user: safeUser, accessState: "TEACHER_PENDING_REVIEW" as const, ...result };
      }
      if (user.teacherApprovalState === "REJECTED") {
        const result = await this.generateSession(user.id);
        const { password: _, ...safeUser } = user;
        return { user: safeUser, accessState: "TEACHER_REJECTED" as const, ...result };
      }
    }

    if (user.status === "INACTIVE") {
      throw new AppError("Account is inactive. Contact support.", 403, "ACCOUNT_INACTIVE");
    }

    const result = await this.generateSession(user.id);

    const { password: _, ...safeUser } = user;

    // For an approved teacher, report the entitlement so the client can badge the
    // plan. An APPROVED + ACTIVE teacher always has feature access — FREE_PLAN when
    // there is no active paid subscription, PAID_PLAN when there is. Neither is
    // payment-blocked (the corrected FREE-plan policy), so login always succeeds.
    let accessState: "ACTIVE_TEACHER" | "FREE_TEACHER" | undefined;
    if (user.role === "OPERATION" && user.teacherApprovalState === "APPROVED") {
      const activeSub = await prisma.teacherSubscription.findFirst({
        where: { teacherId: user.id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
        select: { id: true },
      });
      accessState = activeSub ? "ACTIVE_TEACHER" : "FREE_TEACHER";
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
      throw new AppError("Mobile number already registered", 409, "DUPLICATE_MOBILE");
    }

    // Check email uniqueness (only when provided)
    if (input.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existingEmail) {
        throw new AppError("Email already registered", 409, "DUPLICATE_EMAIL");
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

    // Student registration: account starts unverified and with NO session —
    // the student must click the emailed verification link before they can
    // log in (see loginUser's emailVerified gate).
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email,
          password: hashedPassword,
          role: Role.STUDENT,
          status: Status.ACTIVE,
          locale: normalizeLocale(input.locale),
          emailVerified: false,
        },
        select: userPublicFields,
      });

      if (!input.stageId) {
        throw new AppError("Stage is required for student registration", 400, "REQUIRED");
      }
      await tx.studentProfile.create({
        data: { userId: created.id, stageId: input.stageId },
      });

      return created;
    });

    const token = await this.generateEmailVerificationToken(user.id);

    // Dev convenience: EMAIL_DRY_RUN is true by default locally/in CI, so the
    // real email never renders — mirrors the existing `[OTP] ...` console.log
    // used to manually test the password-reset flow (forgotPassword, below).
    console.log(`[EmailVerification] ${user.email}: /verify-email?token=${token}`);

    await sendTransactionalEmail({
      to: user.email,
      template: "emailVerification",
      locale: input.locale,
      data: {
        studentName: user.fullName,
        token,
      },
      metadata: { userId: user.id },
      entityType: "User",
      entityId: user.id,
      dedupeKey: `${user.id}:emailVerification:register`,
    });

    return { pending: false as const, emailVerificationRequired: true as const, user };
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
          locale: normalizeLocale(input.locale),
          // Teachers are gated by admin review (teacherApprovalState), not by
          // email verification — loginUser's email-verification gate excludes
          // OPERATION entirely. Matches AdminUsersService.createUser's
          // trusted-path convention (emailVerified: true there too).
          emailVerified: true,
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

    // No email-verification token/email here — teachers are gated by admin
    // review (emailVerified is already true; see the user.create above), so
    // only the "registration submitted" notification is sent.
    await sendTransactionalEmail({
      to: input.email,
      template: "teacherRegistrationSubmitted",
      locale: input.locale,
      data: {
        teacherName: input.fullName,
        referenceNumber: publicReference,
        status: "PENDING_REVIEW",
        statusUrl: `/teacher/register/status?ref=${encodeURIComponent(publicReference)}`,
      },
      metadata: { requestId: user.requestId },
      entityType: "TeacherRegistrationRequest",
      entityId: user.requestId,
      dedupeKey: `${user.requestId}:teacherRegistrationSubmitted`,
    });

    // The public reference lets the teacher track their request status later
    // (paired with their email/mobile on the public track endpoint).
    return { pending: true as const, user: user.created, trackingReference: publicReference };
  }

  public async forgotPassword(input: ForgotPasswordInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, locale: true },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
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
      throw new AppError("Too many OTP requests. Try again in an hour", 429, "RATE_LIMITED");
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

    // 6. Send OTP via email
    await sendTransactionalEmail({
      to: input.email,
      template: "passwordReset",
      locale: user.locale,
      data: {
        otp,
        expiresIn: "5 minutes",
        resetUrl: "/reset-password",
      },
      metadata: { userId: user.id, purpose: "passwordReset" },
      entityType: "User",
      entityId: user.id,
    });

    return { message: "OTP sent successfully" };
  }

  public async verifyOtp(input: VerifyOtpInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
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
      throw new AppError("OTP has expired", 410, "OTP_EXPIRED");
    }

    const isValid = await bcrypt.compare(input.otp, storedOtp.code);
    if (!isValid) {
      throw new AppError("Invalid OTP code", 400, "OTP_INVALID");
    }

    await prisma.otp.update({
      where: { id: storedOtp.id },
      data: { verifiedAt: new Date() },
    });

    return { message: "OTP verified successfully" };
  }

  public async verifyEmail(input: VerifyEmailInput) {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");

    const storedToken = await prisma.otp.findFirst({
      where: {
        code: hashedToken,
        type: OtpType.EMAIL_VERIFICATION,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new AppError("Invalid or expired verification link", 410, "VERIFICATION_TOKEN_EXPIRED");
    }

    await prisma.$transaction([
      prisma.otp.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: storedToken.userId },
        data: { emailVerified: true },
      }),
    ]);

    return { message: "Email verified successfully" };
  }

  public async resendVerificationEmail(input: ResendVerificationInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, fullName: true, email: true, locale: true, emailVerified: true },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (user.emailVerified) {
      return { message: "Email is already verified" };
    }

    // Same DB-row-count rate-limit pattern as forgotPassword's OTP throttle,
    // scaled down to the ticket's "max 1 email per 60 seconds" requirement.
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCount = await prisma.otp.count({
      where: {
        userId: user.id,
        type: OtpType.EMAIL_VERIFICATION,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentCount >= 1) {
      throw new AppError("Please wait before requesting another email.", 429, "RATE_LIMITED");
    }

    const token = await this.generateEmailVerificationToken(user.id);

    console.log(`[EmailVerification] ${user.email}: /verify-email?token=${token}`);

    await sendTransactionalEmail({
      to: user.email!,
      template: "emailVerification",
      locale: user.locale,
      data: {
        studentName: user.fullName,
        token,
      },
      metadata: { userId: user.id },
      entityType: "User",
      entityId: user.id,
    });

    return { message: "Verification email sent" };
  }

  public async resetPassword(input: ResetPasswordInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
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
      throw new AppError("Please verify your OTP first", 400, "OTP_NOT_VERIFIED");
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
      throw new AppError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
    }
    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!userId) throw new AppError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");

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
      throw new AppError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
    }
    if (payloadVersion !== undefined && user.tokenVersion !== payloadVersion) {
      throw new AppError("Session superseded by new login", 401, "SESSION_SUPERSEDED");
    }
    // BANNED users are always blocked from refreshing.
    if (user.status === "BANNED") {
      throw new AppError("Account is inactive. Contact support.", 403, "ACCOUNT_INACTIVE");
    }

    // INACTIVE teachers with PENDING_REVIEW or REJECTED approval state are
    // allowed to refresh (restricted mode — they can view their review-status
    // page). Other INACTIVE users remain blocked.
    if (user.status === "INACTIVE") {
      const fullUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, teacherApprovalState: true },
      });
      const isRestrictedTeacher =
        fullUser?.role === "OPERATION" &&
        (fullUser?.teacherApprovalState === "PENDING_REVIEW" ||
          fullUser?.teacherApprovalState === "REJECTED");
      if (!isRestrictedTeacher) {
        throw new AppError("Account is inactive. Contact support.", 403, "ACCOUNT_INACTIVE");
      }
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
      throw new AppError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
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
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return user;
  }

  public async googleAuth(credential: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError("Google sign-in is not configured", 501, "GOOGLE_AUTH_NOT_CONFIGURED");
    }

    // Verify the access token by calling Google's userinfo endpoint
    let userInfo: { email?: string; name?: string; sub?: string };
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${credential}`,
      );
      userInfo = await response.json();
      if (!response.ok || !userInfo.email) {
        throw new AppError("Invalid Google access token", 401, "GOOGLE_AUTH_FAILED");
      }
    } catch {
      // Fallback: try userinfo endpoint which requires a valid token
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${credential}` } },
      );
      if (!response.ok) {
        throw new AppError("Invalid Google access token", 401, "GOOGLE_AUTH_FAILED");
      }
      userInfo = await response.json();
    }

    if (!userInfo.email) {
      throw new AppError("Failed to get email from Google", 400, "GOOGLE_AUTH_FAILED");
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
        throw new AppError("Account is inactive. Contact support.", 403, "ACCOUNT_INACTIVE");
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
          // Google already verified this address.
          emailVerified: true,
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
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      input.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 401, "CURRENT_PASSWORD_INVALID");
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: "Password changed successfully" };
  }

  public async updateLocale(userId: string, input: UpdateLocaleInput) {
    return prisma.user.update({
      where: { id: userId },
      data: { locale: input.locale },
      select: userPublicFields,
    });
  }
}
