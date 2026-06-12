import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OtpType, Role, Status } from "../../generated/prisma/index.js";
import { prisma } from "../../config/database.js";
import { userPublicFields } from "../users/user.types.js";
import { TokenService } from "./token.service.js";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
} from "./auth.validation.js";
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

    const accessToken = this.tokenService.generateAccessToken(user.id);
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id },
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

    // Return user WITHOUT password + accessToken
    return { user, accessToken };
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
}
