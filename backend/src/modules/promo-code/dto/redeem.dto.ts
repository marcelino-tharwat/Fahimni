import { z } from "zod";
import { CODE_CHARSET, CODE_LENGTH } from "../promo-code.service.js";

// Code must be exactly CODE_LENGTH characters from the STORY-52 alphabet
// (after trim + uppercase). The charset contains only A–Z/2–9, so it is safe to
// embed directly in a character class.
const codePattern = new RegExp(`^[${CODE_CHARSET}]{${CODE_LENGTH}}$`);

/**
 * STORY-53 canonical redeem body: `{ code, chapterId }`.
 *
 * Strict: unknown and client-controlled fields (studentId, usedByStudentId,
 * createdBy, isUsed, usedAt, paymentMethod, enrollmentStatus, …) are rejected.
 * The student identity always comes from the auth context, never the body.
 */
export const redeemDtoSchema = z
  .object({
    code: z
      .string({ error: "Promo code is required" })
      .trim()
      .toUpperCase()
      .regex(codePattern, "Invalid promo code format"),
    chapterId: z
      .string({ error: "Chapter ID is required" })
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Chapter ID must be a valid UUID",
      ),
  })
  .strict();

export type RedeemDtoInput = z.infer<typeof redeemDtoSchema>;
