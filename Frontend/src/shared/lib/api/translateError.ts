import type { TFunction } from "i18next";
import type { ApiError, ApiFieldError } from "./client";

/**
 * Maps stable backend error codes to `validation:*` i18n keys. Every code the
 * backend can emit for a scoped form (auth, teacher-request, admin, student
 * enrollment/payment, teacher content) should have an entry here — that's
 * what lets the frontend show the message in the *current* UI language
 * regardless of what language (if any) the backend's raw message was in.
 */
const CODE_TO_VALIDATION_KEY: Record<string, string> = {
  // Generic Zod-derived validation codes (see backend validationCodes.ts)
  REQUIRED: "validation:required",
  EMAIL_INVALID: "validation:emailInvalid",
  MOBILE_INVALID: "validation:mobileInvalid",
  PASSWORD_MIN: "validation:passwordMin",
  PASSWORD_MAX: "validation:passwordMax",
  PASSWORD_MISMATCH: "validation:passwordMismatch",
  TOO_SHORT: "validation:tooShort",
  TOO_LONG: "validation:tooLong",
  INVALID_CHOICE: "validation:invalidChoice",
  INVALID_FORMAT: "validation:invalidFormat",
  INVALID_ID: "validation:invalidId",
  INVALID_VALUE: "validation:invalidValue",

  // Auth / account
  INVALID_CREDENTIALS: "validation:invalidCredentials",
  CURRENT_PASSWORD_INVALID: "validation:currentPasswordInvalid",
  ACCOUNT_INACTIVE: "validation:accountInactive",
  SESSION_SUPERSEDED: "validation:sessionSuperseded",
  TOKEN_EXPIRED: "validation:tokenExpired",
  TOKEN_INVALID: "validation:tokenInvalid",
  REFRESH_TOKEN_INVALID: "validation:refreshTokenInvalid",
  USER_NOT_FOUND: "validation:userNotFound",
  RATE_LIMITED: "validation:rateLimited",
  OTP_EXPIRED: "validation:otpExpired",
  OTP_INVALID: "validation:otpInvalid",
  OTP_NOT_VERIFIED: "validation:otpNotVerified",
  GOOGLE_AUTH_FAILED: "validation:googleAuthFailed",
  GOOGLE_AUTH_NOT_CONFIGURED: "validation:googleAuthNotConfigured",
  DUPLICATE_EMAIL: "validation:duplicateEmail",
  DUPLICATE_MOBILE: "validation:duplicateMobile",
  DUPLICATE_EMAIL_OR_MOBILE: "validation:duplicateEmailOrMobile",
  DUPLICATE_PENDING_REQUEST: "validation:duplicatePendingRequest",
  EXISTING_OPERATION_USER: "validation:existingOperationUser",
  PROOF_UPLOAD_FAILED: "validation:proofUploadFailed",

  // Files
  FILE_TOO_LARGE: "validation:fileTooLarge",
  FILE_TYPE_INVALID: "validation:fileTypeInvalid",
  MAX_FILES_EXCEEDED: "validation:maxFilesExceeded",
  FILE_UPLOAD_ERROR: "validation:fileUploadError",

  // Authorization
  UNAUTHENTICATED: "validation:unauthorized",
  FORBIDDEN: "validation:forbidden",

  // Payment / enrollment
  COURSE_NOT_AVAILABLE: "validation:courseNotAvailable",
  CHAPTER_NOT_FOUND: "validation:chapterNotFound",
  CHAPTER_FREE: "validation:chapterFree",
  CHAPTER_NOT_FREE: "validation:chapterNotFree",
  ALREADY_ENROLLED: "validation:alreadyEnrolled",
  STUDENT_NOT_FOUND: "validation:studentNotFound",
  PAYMENT_NOT_FOUND: "validation:paymentNotFound",
  INVALID_HMAC: "validation:invalidHmac",
  ENROLLMENT_NOT_FOUND: "validation:enrollmentNotFound",
  ENROLLMENT_ALREADY_DEACTIVATED: "validation:enrollmentAlreadyDeactivated",

  // Admin — users
  LAST_ACTIVE_ADMIN: "validation:lastActiveAdmin",
  SELF_STATUS_CHANGE: "validation:selfStatusChange",
  SELF_ROLE_CHANGE: "validation:selfRoleChange",
  SELF_PASSWORD_RESET: "validation:selfPasswordReset",
  ROLE_CHANGE_BLOCKED_HAS_TEACHER_DATA: "validation:roleChangeBlockedHasTeacherData",
  ROLE_CHANGE_BLOCKED_HAS_STUDENT_DATA: "validation:roleChangeBlockedHasStudentData",

  // Admin — plans
  PLAN_CODE_DUPLICATE: "validation:planCodeDuplicate",
  FREE_PLAN_MUST_BE_FREE: "validation:freePlanMustBeFree",
  PLAN_NOT_FOUND: "validation:planNotFound",

  // Admin — teacher requests
  TEACHER_REQUEST_NOT_FOUND: "validation:teacherRequestNotFound",
  DOCUMENT_UNAVAILABLE: "validation:documentUnavailable",
  REQUEST_NOT_PENDING: "validation:requestNotPending",

  // Promo codes (course + teacher-plan)
  PROMO_NOT_FOUND: "validation:promoNotFound",
  PROMO_SCOPE_MISMATCH: "validation:promoScopeMismatch",
  PROMO_INACTIVE: "validation:promoInactive",
  PROMO_NOT_STARTED: "validation:promoNotStarted",
  PROMO_EXPIRED: "validation:promoExpired",
  PROMO_LIMIT_REACHED: "validation:promoLimitReached",
  PROMO_USER_LIMIT_REACHED: "validation:promoUserLimitReached",
  PROMO_PLAN_NOT_ALLOWED: "validation:promoPlanNotAllowed",
  PROMO_INTERVAL_NOT_ALLOWED: "validation:promoIntervalNotAllowed",
  INVALID_CODE: "validation:promoNotFound",
  CODE_ALREADY_USED: "validation:promoUserLimitReached",
  CODE_NOT_FOR_THIS_CHAPTER: "validation:promoScopeMismatch",
};

/**
 * Translate a whole-request error (login failed, save failed, …) into the
 * current UI language. Prefers a known `code` over the backend's raw
 * `message` (which may be in the wrong language); falls back to a safe,
 * always-localized generic message when the code is unknown.
 */
export function translateApiError(t: TFunction, error: unknown): string {
  const apiError = error as ApiError | undefined;
  const code = apiError?.code;
  if (code && CODE_TO_VALIDATION_KEY[code]) {
    return t(CODE_TO_VALIDATION_KEY[code]);
  }
  return t("validation:genericError");
}

/** Translate a single field error entry by its stable code. */
export function translateFieldError(t: TFunction, fieldError: ApiFieldError): string {
  const key = CODE_TO_VALIDATION_KEY[fieldError.code];
  return key ? t(key) : t("validation:genericError");
}

/**
 * Translate the backend's structured `errors[]` (field + code) into a
 * `{ field: message }` map in the current UI language, for attaching to
 * form fields (react-hook-form `setError`, manual field-error state, …).
 */
export function translateFieldErrors(
  t: TFunction,
  error: unknown,
): Record<string, string> {
  const apiError = error as ApiError | undefined;
  const errors = apiError?.errors;
  if (!errors || errors.length === 0) return {};
  const result: Record<string, string> = {};
  for (const fieldError of errors) {
    result[fieldError.field] = translateFieldError(t, fieldError);
  }
  return result;
}
