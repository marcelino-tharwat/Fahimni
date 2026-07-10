import { z } from "zod";
import type { TFunction } from "i18next";

/**
 * Client-side mirror of the backend `updateTeacherProfileSchema`
 * (backend/src/modules/teacher/teacher.validation.ts).
 *
 * Keep these rules in lockstep with the backend so client validation
 * never disagrees with what the server will accept. Messages are resolved
 * through i18next at validation time, so the schema must be built with the
 * current `t` function (factory) rather than defined once as a constant —
 * that way errors follow the active language, even after a language switch.
 */
export function createTeacherProfileSchema(t: TFunction) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(3, t("settings.validation.fullNameMin"))
      .max(100, t("settings.validation.fullNameMax"))
      .optional(),
    email: z
      .string()
      .trim()
      .email(t("settings.validation.emailInvalid"))
      .toLowerCase()
      .optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^01[0-9]{9}$/, t("settings.validation.mobileInvalid"))
      .optional(),
    subject: z.string().trim().optional(),
    bio: z
      .string()
      .trim()
      .max(500, t("settings.validation.bioMax"))
      .optional(),
  });
}

export type UpdateTeacherProfileInput = z.infer<
  ReturnType<typeof createTeacherProfileSchema>
>;

/**
 * Flatten a ZodError into a `{ field: firstMessage }` map for inline display.
 * Only the first issue per field is kept (matches how the inputs render one
 * error line each). Version-agnostic — walks `issues` directly.
 */
export const flattenZodErrors = zodToFieldErrors;

export function zodToFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

/**
 * Normalise any stored mobile (e.g. "+201012345678", "201012345678",
 * "1012345678") into the canonical local Egyptian form "01012345678".
 */
export function normalizeMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("20")) digits = digits.slice(2);
  if (digits && !digits.startsWith("0")) digits = `0${digits}`;
  return digits;
}

/** Max upload size accepted by the backend (multer): 5 MB. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ────────────────────────────────────────────────────────────────────────
 * Content management form schemas (Chapter / Lesson / Stage).
 *
 * Client-side mirrors of the backend Zod schemas (chapter.validation.ts,
 * lessons.validation.ts, stage.validation.ts). Built as factories so error
 * messages resolve through the active i18next language — same pattern as
 * createTeacherProfileSchema above.
 *
 * `sortOrder` is intentionally omitted from the form schemas: the UI computes
 * it (append-to-end) rather than asking the user for it.
 * ──────────────────────────────────────────────────────────────────────── */

export function createChapterSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("contentValidation.nameRequired"))
      .max(200, t("contentValidation.nameMax")),
    description: z
      .string()
      .trim()
      .max(2000, t("contentValidation.descriptionMax"))
      .optional()
      .or(z.literal("")),
    price: z
      .number()
      .min(0, t("contentValidation.priceMin"))
      .optional()
      .nullable(),
  });
}

export type CreateChapterFormInput = z.infer<
  ReturnType<typeof createChapterSchema>
>;

export function createLessonSchema(t: TFunction) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("contentValidation.titleRequired"))
      .max(200, t("contentValidation.titleMax")),
    description: z
      .string()
      .trim()
      .max(2000, t("contentValidation.descriptionMax"))
      .optional()
      .or(z.literal("")),
    // Forms pass NaN (or "") for an empty duration field. Normalise that to
    // `undefined` so the user sees a friendly "required" message instead of
    // the raw Zod "expected number, received NaN".
    durationMinutes: z.preprocess(
      (v) => {
        if (typeof v === "string") {
          const s = v.trim();
          return s === "" ? undefined : Number(s);
        }
        if (typeof v === "number" && Number.isNaN(v)) return undefined;
        return v;
      },
      z
        .number({ error: t("contentValidation.durationRequired") })
        .int(t("contentValidation.durationInt"))
        .min(1, t("contentValidation.durationMin"))
        .max(300, t("contentValidation.durationMax")),
    ),
    youtubeUrl: z
      .string()
      .trim()
      .refine(
        (v) => {
          if (!v) return true;
          try {
            const url = new URL(v);
            const host = url.hostname.replace("www.", "");
            return ["youtube.com", "m.youtube.com", "youtu.be"].includes(host);
          } catch {
            return false;
          }
        },
        { message: t("contentValidation.youtubeUrlInvalid") },
      )
      .optional()
      .or(z.literal("")),
  });
}

export type CreateLessonFormInput = z.infer<
  ReturnType<typeof createLessonSchema>
>;

export function createStageUpdateSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("contentValidation.nameRequired"))
      .max(200, t("contentValidation.nameMax")),
    description: z
      .string()
      .trim()
      .max(2000, t("contentValidation.descriptionMax"))
      .optional()
      .or(z.literal("")),
  });
}

export type UpdateStageFormInput = z.infer<
  ReturnType<typeof createStageUpdateSchema>
>;

/**
 * Client-side mirror of the backend `updatePayoutProfileSchema`
 * (backend/src/modules/teacher-wallet/teacher-wallet.validation.ts). Only
 * fields present in the parsed input are ever sent to the backend — see
 * EditPayoutProfileModal, which omits a field entirely when its raw value is
 * the empty string (untouched) and includes it (for validation) the moment
 * the user has typed anything, including whitespace-only, so that case still
 * surfaces as an error rather than silently being dropped.
 */
export function createPayoutProfileSchema(t: TFunction) {
  return z
    .object({
      instaPayHandle: z
        .string()
        .trim()
        .min(3, t("wallet.validation.instaPayMin"))
        .max(50, t("wallet.validation.instaPayMax"))
        .regex(/^[A-Za-z0-9@._-]+$/, t("wallet.validation.instaPayInvalid"))
        .optional(),
      vodafoneCashNumber: z
        .string()
        .trim()
        .regex(
          /^(\+20|0)(10|11|12|15)[0-9]{8}$/,
          t("wallet.validation.vodafoneInvalid"),
        )
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      // Explicit path so `flattenZodErrors` (which only keeps issues with a
      // string path[0]) surfaces this under `errors.root` instead of silently
      // dropping it — a root-level `.refine()` has an empty path by default.
      message: t("wallet.validation.atLeastOneRequired"),
      path: ["root"],
    });
}

export type PayoutProfileFormInput = z.infer<
  ReturnType<typeof createPayoutProfileSchema>
>;

/**
 * Client-side mirror of the backend `createWithdrawalSchema`
 * (backend/src/modules/teacher-wallet/teacher-wallet.validation.ts), plus a
 * pre-emptive `availableBalance` ceiling so the over-balance error can surface
 * inline before a round-trip — the backend re-checks this atomically anyway
 * (frontend-only validation is never sufficient on its own).
 */
export function createWithdrawalRequestSchema(t: TFunction, availableBalance: number) {
  return z.object({
    amount: z
      .number({ message: t("wallet.withdrawals.validation.amountRequired") })
      .positive(t("wallet.withdrawals.validation.amountPositive"))
      .max(availableBalance, t("wallet.withdrawals.validation.amountExceedsBalance")),
    teacherNote: z
      .string()
      .trim()
      .max(500, t("wallet.withdrawals.validation.noteMax"))
      .optional(),
  });
}

export type WithdrawalRequestFormInput = z.infer<
  ReturnType<typeof createWithdrawalRequestSchema>
>;
