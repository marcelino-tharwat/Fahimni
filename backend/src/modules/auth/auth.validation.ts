import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters"),
    mobile: z
      .string()
      .trim()
      .regex(/^(\+20|0)(10|11|12|15)[0-9]{8}$/, "Invalid Egyptian phone number"),
    email: z.string().trim().email("Invalid email address").toLowerCase(),
    password: passwordSchema,
    // Optional: when the client sends it (unified register form) it must match.
    // Kept optional so existing callers that omit it stay backward-compatible.
    confirmPassword: z.string().optional(),
    role: z.enum(["STUDENT", "OPERATION"]).default("STUDENT"),
    stageId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().uuid("Stage must be a valid UUID").optional(),
    ),
    // Teacher-only optional profile fields captured at unified registration.
    subject: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().trim().min(2).max(200).optional(),
    ),
    bio: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().trim().max(1000).optional(),
    ),
  })
  .refine(
    (data) => {
      if (data.role === "STUDENT" && !data.stageId) {
        return false;
      }
      return true;
    },
    { message: "Please select your stage", path: ["stageId"] },
  )
  .refine(
    (data) =>
      data.confirmPassword === undefined ||
      data.confirmPassword === data.password,
    { message: "Passwords do not match", path: ["confirmPassword"] },
  );

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain digits only"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain digits only"),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
