import type { ZodError, ZodIssue } from "zod";
import type { Locale } from "./locale.js";

/**
 * Stable, machine-readable validation error codes. These are derived from a
 * Zod issue's structural shape (issue.code / format / minimum / path), never
 * from the issue's hardcoded (usually English) `message` — so this adapter
 * works for every existing Zod schema in the codebase without editing them.
 */
export const VALIDATION_FALLBACK_MESSAGES: Record<string, Record<Locale, string>> = {
  REQUIRED: { en: "This field is required", ar: "هذا الحقل مطلوب" },
  EMAIL_INVALID: { en: "Invalid email address", ar: "البريد الإلكتروني غير صالح" },
  MOBILE_INVALID: { en: "Invalid mobile number", ar: "رقم الهاتف غير صالح" },
  PASSWORD_MIN: { en: "Password is too short", ar: "كلمة المرور قصيرة جدًا" },
  PASSWORD_MAX: { en: "Password is too long", ar: "كلمة المرور طويلة جدًا" },
  PASSWORD_MISMATCH: { en: "Passwords do not match", ar: "كلمتا المرور غير متطابقتين" },
  TOO_SHORT: { en: "Value is too short", ar: "القيمة قصيرة جدًا" },
  TOO_LONG: { en: "Value is too long", ar: "القيمة طويلة جدًا" },
  INVALID_CHOICE: { en: "Invalid choice", ar: "اختيار غير صالح" },
  INVALID_FORMAT: { en: "Invalid format", ar: "صيغة غير صالحة" },
  INVALID_ID: { en: "Invalid identifier", ar: "معرّف غير صالح" },
  INVALID_VALUE: { en: "Invalid value", ar: "قيمة غير صالحة" },
};

export const VALIDATION_ERROR_TOP_LEVEL_MESSAGE: Record<Locale, string> = {
  en: "Validation error",
  ar: "بيانات غير صالحة",
};

export interface NormalizedValidationError {
  field: string;
  code: string;
  message: string;
}

function isMobileField(field: string): boolean {
  return /(mobile|phone|whatsapp)/i.test(field);
}

function isPasswordField(field: string): boolean {
  return /password/i.test(field);
}

/** Classify a single Zod issue into a stable code, ignoring its hardcoded message. */
export function classifyZodIssue(issue: ZodIssue): string {
  const field = String(issue.path[issue.path.length - 1] ?? "");
  const issueRecord = issue as unknown as Record<string, unknown>;

  switch (issue.code) {
    case "invalid_type":
      // A missing required field parses as `received: undefined`.
      return "REQUIRED";
    case "too_small": {
      const minimum = issueRecord.minimum;
      if (minimum === 1) return "REQUIRED";
      if (isPasswordField(field)) return "PASSWORD_MIN";
      return "TOO_SHORT";
    }
    case "too_big":
      return isPasswordField(field) ? "PASSWORD_MAX" : "TOO_LONG";
    case "invalid_format": {
      const format = (issueRecord.validation ?? issueRecord.format) as string | undefined;
      if (format === "email") return "EMAIL_INVALID";
      if (format === "regex" && isMobileField(field)) return "MOBILE_INVALID";
      if (format === "uuid") return "INVALID_ID";
      return "INVALID_FORMAT";
    }
    case "invalid_value":
      return "INVALID_CHOICE";
    case "custom":
      if (field.toLowerCase() === "confirmpassword") return "PASSWORD_MISMATCH";
      return "INVALID_VALUE";
    default:
      return "INVALID_VALUE";
  }
}

/** Turn a ZodError into the stable-code shape the frontend translates by code. */
export function adaptZodError(
  error: ZodError,
  locale: Locale,
): { code: "VALIDATION_ERROR"; message: string; errors: NormalizedValidationError[] } {
  const errors = error.issues.map((issue) => {
    const field = issue.path.join(".") || "_root";
    const code = classifyZodIssue(issue);
    const message = VALIDATION_FALLBACK_MESSAGES[code]?.[locale] ?? issue.message;
    return { field, code, message };
  });

  return {
    code: "VALIDATION_ERROR",
    message: VALIDATION_ERROR_TOP_LEVEL_MESSAGE[locale],
    errors,
  };
}
