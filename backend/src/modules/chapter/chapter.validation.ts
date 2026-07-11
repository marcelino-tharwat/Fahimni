import { z } from "zod";

export const createChapterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Chapter name is required")
    .max(200, "Chapter name must not exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters")
    .optional()
    .nullable(),
  sortOrder: z
    .number()
    .int("Sort order must be an integer")
    .min(1, "Sort order must be at least 1"),
  price: z.number().min(0, "Price must be 0 or greater").optional().nullable(),
  subject: z.string().trim().optional().nullable(),
});

export const updateChapterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Chapter name is required")
      .max(200, "Chapter name must not exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must not exceed 2000 characters")
      .optional()
      .nullable(),
    sortOrder: z
      .number()
      .int("Sort order must be an integer")
      .min(1, "Sort order must be at least 1")
      .optional(),
    price: z
      .number()
      .min(0, "Price must be 0 or greater")
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const reorderSchema = z
  .array(z.string())
  .nonempty("At least one chapter is required")
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate chapter IDs are not allowed",
  });

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
