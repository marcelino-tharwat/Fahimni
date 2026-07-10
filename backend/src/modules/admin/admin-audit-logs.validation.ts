import { z } from "zod";

const dateParam = z.coerce.date().optional();

export const listAuditLogsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  entityId: z.string().trim().max(100).optional(),
  dateFrom: dateParam,
  dateTo: dateParam,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
