import { z } from "zod";

export const createEnrollmentSchema = z.object({
  // IDs in this project are plain strings (uuid in prod, custom slugs in seed
  // data), so we validate non-empty rather than a strict uuid format — matching
  // the existing id validation used across the other modules.
  chapterId: z.string().trim().min(1, "Chapter ID is required"),
  // PAYMOB is the only client-initiated paid path. PROMO enrollments are created
  // by /promo-code/redeem and FREE ones by /enrollments/free — both server-set,
  // never accepted from this endpoint's body.
  paymentMethod: z.enum(["PAYMOB"]),
  promoCodeId: z.string().trim().min(1, "Invalid promo code ID").optional(),
  price: z.number().positive("Price must be a positive number"),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

/**
 * Body for POST /free — direct self-enrollment into a free chapter (no promo
 * code, no payment). Only the chapter id is client-supplied; the student
 * identity comes from the auth context. Mirrors the promo module's redeem DTO
 * style (strict object + UUID-format chapterId) rather than the looser
 * non-empty-string ids used by the other enrollment validators.
 */
export const freeEnrollmentSchema = z
  .object({
    chapterId: z
      .string({ error: "Chapter ID is required" })
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Chapter ID must be a valid UUID",
      ),
  })
  .strict();

export type FreeEnrollmentInput = z.infer<typeof freeEnrollmentSchema>;

// IDs in this project are plain strings (uuid in prod, custom slugs in seed
// data), so we validate non-empty rather than a strict uuid format — matching
// the existing id validation used across the other modules.
export const studentParamSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required"),
});

export type StudentParamInput = z.infer<typeof studentParamSchema>;

// Same rationale as above: enrollment ids are plain strings (uuid in prod,
// custom slugs in seed data), so validate non-empty rather than strict uuid.
export const enrollmentIdParamSchema = z.object({
  id: z.string().trim().min(1, "Enrollment ID is required"),
});

export type EnrollmentIdParamInput = z.infer<typeof enrollmentIdParamSchema>;
