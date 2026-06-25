import { z } from "zod";

/**
 * Safe MVP upper bound on how many questions a single generation request may
 * ask for. Chosen to stay comfortably inside the 25s total generation budget
 * (STORY-45). Documented in docs/api/quiz-generation.md.
 */
export const MAX_QUESTION_COUNT = 20;

/** Maximum length of the optional free-text topic focus. */
export const MAX_TOPIC_FOCUS_LENGTH = 200;

/** Public question types accepted on the wire (mapped to DB types elsewhere). */
export const PUBLIC_QUESTION_TYPES = ["MCQ", "TF", "ESSAY"] as const;
export type PublicQuestionType = (typeof PUBLIC_QUESTION_TYPES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

export const generateQuizSchema = z
  .object({
    chapterId: uuid.optional(),
    lessonIds: z
      .array(uuid)
      .nonempty("lessonIds must contain at least one lesson")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "lessonIds must not contain duplicates",
      )
      .optional(),
    questionCount: z
      .number()
      .int("questionCount must be an integer")
      .min(1, "questionCount must be greater than zero")
      .max(
        MAX_QUESTION_COUNT,
        `questionCount must not exceed ${MAX_QUESTION_COUNT}`,
      ),
    types: z
      .array(z.enum(PUBLIC_QUESTION_TYPES))
      .nonempty("types must contain at least one question type")
      .refine(
        (types) => new Set(types).size === types.length,
        "types must not contain duplicates",
      ),
    difficulty: z.enum(DIFFICULTIES),
    topicFocus: z
      .string()
      .trim()
      .min(1, "topicFocus must not be empty")
      .max(
        MAX_TOPIC_FOCUS_LENGTH,
        `topicFocus must not exceed ${MAX_TOPIC_FOCUS_LENGTH} characters`,
      )
      .optional(),
  })
  // Exactly one content source: chapterId XOR lessonIds.
  .refine((data) => Boolean(data.chapterId) !== Boolean(data.lessonIds), {
    message: "Provide exactly one of chapterId or lessonIds",
    path: ["chapterId"],
  })
  // Every requested type must be representable within questionCount.
  .refine((data) => data.questionCount >= new Set(data.types).size, {
    message:
      "questionCount must be at least the number of selected question types",
    path: ["questionCount"],
  });

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
