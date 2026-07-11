import { z } from "zod";

/** Upper bound on a single question's points (mirrors the generation parser). */
export const MAX_QUESTION_POINTS = 100;

/**
 * Per-question points: required-when-present, integer, > 0, <= 100. The DB
 * column is Int, so decimals are rejected. Optional at the schema level so
 * old clients / partial updates that omit points keep working (the service
 * applies a type-based default on create).
 */
const questionPointsSchema = z
  .number()
  .int("Points must be a whole number")
  .gt(0, "Points must be greater than 0")
  .max(MAX_QUESTION_POINTS, `Points must not exceed ${MAX_QUESTION_POINTS}`);

export const createQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Quiz title is required")
    .max(200, "Quiz title must not exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters")
    .optional()
    .nullable(),
  chapterId: z
    .string()
    .uuid("chapterId must be a valid UUID")
    .optional()
    .nullable(),
  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .min(1, "Duration must be at least 1 minute")
    .optional()
    .nullable(),
});

export const updateQuizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Quiz title is required")
      .max(200, "Quiz title must not exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must not exceed 2000 characters")
      .optional()
      .nullable(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    durationMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be at least 1 minute")
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined,
    {
      message: "At least one field must be provided for update",
    },
  );

export const addQuestionSchema = z.object({
  type: z.enum(["MCQ", "TRUE_FALSE", "ESSAY"]),
  content: z
    .string()
    .trim()
    .min(1, "Question content is required")
    .max(5000, "Question content must not exceed 5000 characters"),
  options: z.record(z.string(), z.string()),
  correctAnswer: z.string().optional().nullable(),
  explanation: z.string().trim().max(2000).optional(),
  points: questionPointsSchema.optional(),
  sortOrder: z
    .number()
    .int("Sort order must be an integer")
    .min(1, "Sort order must be at least 1")
    .optional(),
});

export const updateQuestionSchema = z
  .object({
    type: z.enum(["MCQ", "TRUE_FALSE", "ESSAY"]).optional(),
    content: z
      .string()
      .trim()
      .min(1, "Question content is required")
      .max(5000, "Question content must not exceed 5000 characters")
      .optional(),
    options: z.record(z.string(), z.string()).optional(),
    correctAnswer: z.string().optional().nullable(),
    explanation: z.string().trim().max(2000).optional(),
    points: questionPointsSchema.optional(),
    sortOrder: z
      .number()
      .int("Sort order must be an integer")
      .min(1, "Sort order must be at least 1")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const reorderSchema = z
  .array(z.string())
  .nonempty("At least one question is required for reorder")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate question IDs are not allowed",
  );

export const assignQuizSchema = z.object({
  chapterId: z.string().trim().min(1, "chapterId is required"),
});

export const publishQuizSchema = z.object({
  progressionGateLessonIds: z
    .array(z.string().uuid("Invalid progression gate lesson ID"))
    .optional(),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type AddQuestionInput = z.infer<typeof addQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type AssignQuizInput = z.infer<typeof assignQuizSchema>;
export type PublishQuizInput = z.infer<typeof publishQuizSchema>;
