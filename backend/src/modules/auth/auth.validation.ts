import { z } from "zod";
import { isValidSubject, SUBJECT_CATALOG } from "../subjects/subjects.js";
import { isBlank } from "../../shared/utils/textNormalization.js";

const VALID_SUBJECT_NAMES = SUBJECT_CATALOG.map((s) => s.displayName) as [
  string,
  ...string[],
];

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
      z.enum(VALID_SUBJECT_NAMES, { message: "Invalid subject" }).optional(),
    ),
    // Whitespace-only ("   ", "\n\t") normalizes away to "no bio" — a bare
    // `v === ""` check would miss this, since `.trim()` only runs *after*
    // preprocess and there's no `.min()` to catch the resulting empty string.
    bio: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(1000).optional(),
    ),
    locale: z.enum(["ar", "en"]).optional().default("ar"),
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
  // Never `.trim()` a password — whitespace is significant. A whitespace-only
  // value of sufficient length would otherwise pass `.min(8)` unnoticed and
  // just fail bcrypt comparison with a generic "invalid credentials" message;
  // this refine rejects it explicitly and up front instead.
  password: z.string().min(8).refine((v) => !isBlank(v), {
    message: "Password cannot be blank",
  }),
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
  // Never `.trim()` — same reasoning as loginSchema.password above.
  currentPassword: z
    .string()
    .min(1, "Current password is required")
    .refine((v) => !isBlank(v), { message: "Current password is required" }),
  newPassword: passwordSchema,
});

export const updateLocaleSchema = z.object({
  locale: z.enum(["ar", "en"]),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
