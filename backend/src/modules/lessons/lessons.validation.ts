import { z } from "zod";

const ALLOWED_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

// Validate the parsed hostname instead of an unsafe substring check so that
// unrelated domains that merely contain the word "youtube" are rejected.
function isValidYoutubeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  return ALLOWED_YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
}

const youtubeUrlSchema = z
  .string()
  .trim()
  .refine(isValidYoutubeUrl, "Must be a valid YouTube URL");

export const createLessonSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Lesson title is required")
    .max(200, "Lesson title must not exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters")
    .optional()
    .nullable(),
  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .min(1, "Duration must be greater than 0")
    .max(300, "Duration must not exceed 300 minutes"),
  youtubeUrl: youtubeUrlSchema.optional().nullable(),
  sortOrder: z
    .number()
    .int("Sort order must be an integer")
    .min(1, "Sort order must be at least 1"),
});

export const updateLessonSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Lesson title is required")
      .max(200, "Lesson title must not exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must not exceed 2000 characters")
      .optional()
      .nullable(),
    durationMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be greater than 0")
      .max(300, "Duration must not exceed 300 minutes")
      .optional(),
    youtubeUrl: youtubeUrlSchema.optional().nullable(),
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
  .nonempty("At least one lesson is required")
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate lesson IDs are not allowed",
  });

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
