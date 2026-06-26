import { z } from "zod";

export const checkoutSchema = z.object({
  chapterId: z.string().trim().min(1, "Chapter ID is required"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const webhookSchema = z.object({
  obj: z.object({}).passthrough(),
});

export type WebhookInput = z.infer<typeof webhookSchema>;

export const paymentStatusSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID is required"),
});

export type PaymentStatusInput = z.infer<typeof paymentStatusSchema>;
