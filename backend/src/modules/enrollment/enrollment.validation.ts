import { z } from "zod";

export const createEnrollmentSchema = z.object({
  // IDs in this project are plain strings (uuid in prod, custom slugs in seed
  // data), so we validate non-empty rather than a strict uuid format — matching
  // the existing id validation used across the other modules.
  chapterId: z.string().trim().min(1, "Chapter ID is required"),
  paymentMethod: z.enum(["CASH", "VISA", "PROMO"]),
  promoCodeId: z.string().trim().min(1, "Invalid promo code ID").optional(),
  price: z.number().positive("Price must be a positive number"),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

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
