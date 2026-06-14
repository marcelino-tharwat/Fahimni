import { z } from "zod";

export const createStageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Stage name is required")
    .max(200, "Stage name must not exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters")
    .optional()
    .nullable(),
});

export const updateStageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Stage name is required")
      .max(200, "Stage name must not exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must not exceed 2000 characters")
      .optional()
      .nullable(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field must be provided for update",
  });

export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
