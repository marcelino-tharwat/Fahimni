import { z } from "zod";

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.enum(["true", "false"]).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});
