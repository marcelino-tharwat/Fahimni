import { z } from "zod";

const trimmedContent = z
  .string({ message: "المحتوى مطلوب ويجب أن يكون نصاً." })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(10, "يجب أن يكون السؤال 10 أحرف على الأقل.")
      .max(500, "يجب ألا يتجاوز السؤال 500 حرف."),
  );

export const listConversationsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    archived: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .strict();

export const listMessagesQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "العنوان مطلوب.")
      .max(120, "العنوان طويل جداً.")
      .optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.title !== undefined || body.isArchived !== undefined, {
    message: "يجب تحديد حقل واحد على الأقل للتحديث.",
  });

export const sendMessageSchema = z
  .object({
    content: trimmedContent,
    clientMessageId: z.string().uuid({ message: "معرّف الرسالة غير صالح." }),
  })
  .strict();

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
