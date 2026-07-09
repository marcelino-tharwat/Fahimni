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
