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

export class AuthService {
  constructor(private readonly tokenService = new TokenService()) {}

  public async loginUser(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      const error = new Error("Invalid email or password") as ApiError;
      error.status = 401;
      throw error;
    }

    if (user.status === "INACTIVE" || user.status === "BANNED") {
      const error = new Error(
        "Account is inactive. Contact support.",
      ) as ApiError;
      error.status = 403;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      const error = new Error("Invalid email or password") as ApiError;
      error.status = 401;
      throw error;
    }

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    const accessToken = this.tokenService.generateAccessToken(user.id);
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    // Persist only the SHA-256 hash — never the raw refresh token.
    await prisma.refreshToken.create({
      data: { token: hashRefreshToken(refreshToken), userId: user.id, expiresAt },
    });

    const { password: _, ...safeUser } = user;

    return { user: safeUser, accessToken, refreshToken };
  }

  public async registerUser(input: RegisterInput) {
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

    // Hash password with salt rounds = 12
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Create user + optional StudentProfile in a single transaction
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email,
          password: hashedPassword,
          role: input.role === "OPERATION" ? Role.OPERATION : Role.STUDENT,
          status: Status.ACTIVE,
        },
        select: userPublicFields,
      });

      if (input.role === "OPERATION") {
        await tx.teacherProfile.create({
          data: { userId: created.id },
        });
      }

      if (input.role === "STUDENT") {
        await tx.studentProfile.create({
          data: { userId: created.id },
        });
      }

      return created;
    });

    // Generate JWT: payload = { userId, role }, expiry from env (fallback 30d)
    const accessToken = this.tokenService.generateRegisterToken(
      user.id,
      user.role,
    );

    // Generate and store refresh token
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: hashRefreshToken(refreshToken), userId: user.id, expiresAt },
    });

    // Return user WITHOUT password + accessToken
    return { user, accessToken, refreshToken };
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

    // 2. Rotate atomically IN PLACE — preserves the row id and createdAt so the
    //    STORY-66 last-login proxy keeps reflecting the original login, not each
    //    refresh. A replayed/already-rotated/expired token matches zero rows, so
    //    concurrent reuse yields exactly one valid successor.
    const oldHash = hashRefreshToken(incomingRefreshToken);
    const newRefreshToken = this.tokenService.generateRefreshToken(userId);
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

    // 3. The user must still exist and be allowed to authenticate.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userPublicFields,
    });
    if (!user) {
      await prisma.refreshToken.deleteMany({ where: { token: newHash } });
      throw new AppError("Invalid refresh token", 401);
    }
    if (user.status === "INACTIVE" || user.status === "BANNED") {
      await prisma.refreshToken.deleteMany({ where: { token: newHash } });
      const error = new Error("Account is inactive. Contact support.") as ApiError;
      error.status = 403;
      throw error;
    }

    const newAccessToken = this.tokenService.generateAccessToken(userId);
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
