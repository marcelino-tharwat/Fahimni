import { z } from "zod";

// Same Egyptian mobile format accepted elsewhere in the codebase (teacher
// profile / registration), reused here for the Vodafone Cash wallet number.
const EGYPT_MOBILE_REGEX = /^(\+20|0)(10|11|12|15)[0-9]{8}$/;

// InstaPay handles vary in shape (a phone number, "name@bank", or a custom
// handle) — validated generically: no internal whitespace, safe character
// set, reasonable length. `.trim()` runs before `.min()`/`.regex()` so a
// whitespace-only value fails `.min(1)` (rejected, not silently emptied).
const instaPayHandleSchema = z
  .string()
  .trim()
  .min(3, "InstaPay handle must be at least 3 characters")
  .max(50, "InstaPay handle must not exceed 50 characters")
  .regex(
    /^[A-Za-z0-9@._-]+$/,
    "InstaPay handle may only contain letters, numbers, and @ . _ -",
  );

const vodafoneCashNumberSchema = z
  .string()
  .trim()
  .regex(
    EGYPT_MOBILE_REGEX,
    "Vodafone Cash number must be a valid Egyptian mobile number (e.g. 01012345678)",
  );

export const updatePayoutProfileSchema = z
  .object({
    instaPayHandle: instaPayHandleSchema.optional(),
    vodafoneCashNumber: vodafoneCashNumberSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one payout field must be provided",
  });

export type UpdatePayoutProfileInput = z.infer<typeof updatePayoutProfileSchema>;

export const createWithdrawalSchema = z.object({
  amount: z
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than zero"),
  teacherNote: z.string().trim().max(500, "Note must not exceed 500 characters").optional(),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
