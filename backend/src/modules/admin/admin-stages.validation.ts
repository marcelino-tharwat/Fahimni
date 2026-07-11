import { z } from "zod";

export const listStagesQuerySchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["sortOrder", "name", "createdAt"]).default("sortOrder"),
  sort: z.enum(["asc", "desc"]).default("asc"),
});

export type ListStagesQuery = z.output<typeof listStagesQuerySchema>;

const nonEmptyName = z.string().min(1, "Required").max(200);

export const createStageSchema = z.object({
  name: nonEmptyName,
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export type CreateStageInput = z.input<typeof createStageSchema>;

export const updateStageSchema = z.object({
  name: nonEmptyName.optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateStageInput = z.input<typeof updateStageSchema>;

export const updateStageStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateStageStatusInput = z.input<typeof updateStageStatusSchema>;

export const reorderSchema = z.array(z.string().uuid());

export type ReorderInput = z.input<typeof reorderSchema>;
