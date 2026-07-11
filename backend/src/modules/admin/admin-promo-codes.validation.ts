import { z } from "zod";

const SCOPES = ["TEACHER_PLAN"] as const;
const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
const BILLING = ["MONTHLY", "YEARLY", "ALL"] as const;

export const listPromoCodesQuerySchema = z.object({
  scope: z.enum(SCOPES).optional().default("TEACHER_PLAN"),
  q: z.string().trim().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPromoCodeSchema = z
  .object({
    code: z.string().trim().min(3).max(40).toUpperCase(),
    scope: z.enum(SCOPES).default("TEACHER_PLAN"),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.number().positive(),
    currency: z.string().trim().length(3).toUpperCase().default("EGP"),
    startsAt: z.coerce.date().nullish(),
    expiresAt: z.coerce.date().nullish(),
    isActive: z.boolean().default(true),
    maxUses: z.number().int().positive().nullish(),
    perUserLimit: z.number().int().positive().nullish(),
    applicablePlanIds: z.array(z.string().uuid()).default([]),
    billingInterval: z.enum(BILLING).default("ALL"),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage cannot exceed 100" });
    }
    if (data.startsAt && data.expiresAt && data.startsAt > data.expiresAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "expiresAt must be after startsAt" });
    }
  });

// Update: same shape but everything optional; scope is immutable (not accepted).
export const updatePromoCodeSchema = z
  .object({
    discountType: z.enum(DISCOUNT_TYPES).optional(),
    discountValue: z.number().positive().optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    startsAt: z.coerce.date().nullish(),
    expiresAt: z.coerce.date().nullish(),
    isActive: z.boolean().optional(),
    maxUses: z.number().int().positive().nullish(),
    perUserLimit: z.number().int().positive().nullish(),
    applicablePlanIds: z.array(z.string().uuid()).optional(),
    billingInterval: z.enum(BILLING).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const statusChangeSchema = z.object({ isActive: z.boolean() });

export type ListPromoCodesQuery = z.infer<typeof listPromoCodesQuerySchema>;
export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof updatePromoCodeSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
