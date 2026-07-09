import { z } from "zod";

export const createSubscriptionRequestSchema = z.object({
  planId: z.string().uuid("معرف الباقة غير صالح"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
});

// Checkout accepts a plan id + interval + an OPTIONAL promo code. Price/currency/
// limits/discount are always resolved server-side from the DB plan + promo; the
// client cannot influence them (the promo discount is recomputed on the server).
export const checkoutSchema = z.object({
  planId: z.string().uuid("معرف الباقة غير صالح"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  promoCode: z.string().trim().min(1).max(40).optional(),
});

export const promoPreviewSchema = z.object({
  planId: z.string().uuid("معرف الباقة غير صالح"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  promoCode: z.string().trim().min(1).max(40),
});

export const planIdParamSchema = z.object({
  params: z.object({
    planId: z.string().uuid("معرف الباقة غير صالح"),
  }),
});
