import { z } from "zod";

/**
 * Query params for the list endpoint. Express delivers query values as strings,
 * so page/limit are coerced and isUsed is parsed from the literal "true"/"false"
 * (z.coerce.boolean would treat any non-empty string as true).
 */
export const listPromoCodesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isUsed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ListPromoCodesQuery = z.infer<typeof listPromoCodesSchema>;

/**
 * The :code route param — exactly 8 uppercase alphanumeric characters. Input is
 * trimmed and upper-cased first so a lowercased code still matches.
 */
export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "Promo code must be 8 uppercase alphanumeric characters"),
});

export type CodeParamInput = z.infer<typeof codeParamSchema>;

// Redeem body. The code itself comes from the :code route param; the body only
// carries the chapter the free PROMO enrollment is created for. IDs in this
// project are plain strings (uuid in prod, custom slugs in seed data), so
// chapterId is validated non-empty rather than as a strict uuid — matching the
// existing id validation used across the other modules.
//
// The preprocess step normalizes a missing/null body to an empty object so a
// request with no body still produces a field-level `chapterId` error instead
// of a root-level "expected object" error (which flatten() drops into the empty
// fieldErrors {}). The `error` param gives the missing-key case the same
// "Chapter ID is required" message as the empty-string case, since the type
// check fires before .min() when the key is absent.
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
