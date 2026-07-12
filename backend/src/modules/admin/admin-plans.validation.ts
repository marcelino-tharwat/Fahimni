import { z } from "zod";

export const listPlansQuerySchema = z.object({
  q: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? "true" : v === "false" ? "false" : undefined)),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["sortOrder", "monthlyPrice", "createdAt", "displayName"]).default("sortOrder"),
  sort: z.enum(["asc", "desc"]).default("asc"),
});

export type ListPlansQuery = z.output<typeof listPlansQuerySchema>;

// ── Mutation schemas ──

// `.trim()` runs before `.min()` so tab/space/newline-only input ("\t", "   ")
// is treated as empty rather than as a valid non-empty string.
const nonEmptyString = z.string().trim().min(1, "Required").max(200);
const codePattern = /^[A-Z][A-Z0-9_]{1,19}$/;
const price = z.number().min(0, "Must be 0 or greater");

export const createPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(codePattern, "Code must be uppercase alphanumeric (e.g. BASIC, PRO)"),
  name: nonEmptyString,
  displayName: nonEmptyString,
  description: z.string().trim().max(1000).optional().nullable().default(null),
  monthlyPrice: price.default(0),
  yearlyPrice: price.optional().nullable().default(null),
  currency: z.string().max(10).default("EGP"),
  features: z.record(z.string(), z.boolean()).optional().default({}),
  limits: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({}),
  isActive: z.boolean().optional().default(true),
  isRecommended: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type CreatePlanInput = z.input<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  name: nonEmptyString.optional(),
  displayName: nonEmptyString.optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  monthlyPrice: price.optional(),
  yearlyPrice: price.optional().nullable(),
  features: z.record(z.string(), z.boolean()).optional(),
  limits: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
  isActive: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdatePlanInput = z.input<typeof updatePlanSchema>;

export const statusChangeSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(1, "Reason is required when changing status").optional(),
});

export type StatusChangeInput = z.input<typeof statusChangeSchema>;

export const recommendedChangeSchema = z.object({
  isRecommended: z.boolean(),
});

export type RecommendedChangeInput = z.input<typeof recommendedChangeSchema>;

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid("Invalid plan ID"),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, "At least one item is required"),
});

export type ReorderInput = z.input<typeof reorderSchema>;
