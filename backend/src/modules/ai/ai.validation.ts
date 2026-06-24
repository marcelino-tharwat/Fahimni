import { z } from "zod";

export const indexLessonSchema = z.object({
  pdfText: z.string().min(1, "pdfText is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const lessonIdParamSchema = z.object({
  lessonId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid UUID",
    ),
});

export const similarityQuerySchema = z.object({
  query: z.string().min(1, "query is required"),
  // lessonId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).optional(),
  k: z.coerce.number().int().min(1).max(50).default(5),
});

export type IndexLessonInput = z.infer<typeof indexLessonSchema>;
export type LessonIdParam = z.infer<typeof lessonIdParamSchema>;
export type SimilarityQueryInput = z.infer<typeof similarityQuerySchema>;
