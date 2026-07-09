import { z } from "zod";

export const listPromoCodesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isUsed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ListPromoCodesQuery = z.infer<typeof listPromoCodesSchema>;

export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "Promo code must be 8 uppercase alphanumeric characters"),
});

export type CodeParamInput = z.infer<typeof codeParamSchema>;

export const createPromoCodeSchema = z.object({
  chapterId: z
    .string({ error: "Chapter ID is required" })
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Chapter ID must be a valid UUID",
    ),
});

export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;

export const redeemPromoCodeSchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({
    chapterId: z
      .string({ error: "Chapter ID is required" })
      .trim()
      .min(1, "Chapter ID is required"),
  }),
);

export type RedeemPromoCodeInput = z.infer<typeof redeemPromoCodeSchema>;

/** Preview a COURSE_PURCHASE platform discount code against a chapter. A
 * TEACHER_PLAN code is rejected by the shared validator (scope separation). */
export const courseDiscountSchema = z.object({
  code: z.string().trim().min(1).max(40),
  chapterId: z.string().uuid("Chapter ID must be a valid UUID"),
});

export type CourseDiscountInput = z.infer<typeof courseDiscountSchema>;
