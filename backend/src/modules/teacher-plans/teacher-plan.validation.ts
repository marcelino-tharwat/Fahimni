import { z } from "zod";

export const createSubscriptionRequestSchema = z.object({
  body: z.object({
    planId: z.string().uuid("معرف الباقة غير صالح"),
    billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  }),
});

export const planIdParamSchema = z.object({
  params: z.object({
    planId: z.string().uuid("معرف الباقة غير صالح"),
  }),
});
