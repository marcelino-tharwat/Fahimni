import { z } from "zod";

export const createSubscriptionRequestSchema = z.object({
  planId: z.string().uuid("معرف الباقة غير صالح"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
});

// Checkout only accepts a plan id + interval. Price/currency/limits are always
// resolved server-side from the DB plan; the client cannot influence them.
export const checkoutSchema = z.object({
  planId: z.string().uuid("معرف الباقة غير صالح"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
});

export const planIdParamSchema = z.object({
  params: z.object({
    planId: z.string().uuid("معرف الباقة غير صالح"),
  }),
});
