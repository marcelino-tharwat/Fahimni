import { z } from "zod";

/**
 * Client-side mirror of the backend `updateTeacherProfileSchema`
 * (backend/src/modules/teacher/teacher.validation.ts).
 *
 * Keep these rules in lockstep with the backend so client validation
 * never disagrees with what the server will accept. Messages are in
 * Arabic to surface directly in the UI.
 */
export const updateTeacherProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "الاسم لازم يكون حرفين على الأقل")
    .max(100, "الاسم لازم يكون أقل من ١٠٠ حرف")
    .optional(),
  email: z
    .string()
    .trim()
    .email("البريد الإلكتروني غير صحيح")
    .toLowerCase()
    .optional(),
  mobile: z
    .string()
    .trim()
    .regex(
      /^01[0-9]{9}$/,
      "رقم الموبايل لازم يكون رقم مصري صحيح (مثال: 01012345678)",
    )
    .optional(),
  subject: z.string().trim().optional(),
  bio: z
    .string()
    .trim()
    .max(500, "النبذة التعريفية لازم تكون أقل من ٥٠٠ حرف")
    .optional(),
});

export type UpdateTeacherProfileInput = z.infer<
  typeof updateTeacherProfileSchema
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
