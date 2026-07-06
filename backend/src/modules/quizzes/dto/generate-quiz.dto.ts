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

export const QUIZ_DIFFICULTY_MODES = ["SINGLE", "MIXED"] as const;
export type QuizDifficultyMode = (typeof QUIZ_DIFFICULTY_MODES)[number];

export const QUIZ_CONTENT_SCOPES = ["CHAPTER", "SELECTED_LESSONS"] as const;
export type QuizContentScopeWire = (typeof QUIZ_CONTENT_SCOPES)[number];

/**
 * Source scope of the CONTENT used to generate questions. This is distinct from
 * Quiz.contentScope (lesson placement) and Lesson.requiredQuizId (progression
 * gate). Defaults to SINGLE_CHAPTER when omitted so legacy chapterId-only
 * requests keep working unchanged.
 */
export const SOURCE_SCOPES = [
  "SINGLE_CHAPTER",
  "MULTI_CHAPTER",
  "FULL_CURRICULUM",
] as const;
export type SourceScope = (typeof SOURCE_SCOPES)[number];

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

const lessonIdsField = z
  .array(uuid)
  .default([])
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "lessonIds must not contain duplicates",
  );

export const difficultyDistributionSchema = z
  .object({
    easy: z
      .number()
      .finite("easy must be a finite number")
      .min(0, "easy must be between 0 and 100")
      .max(100, "easy must be between 0 and 100"),
    medium: z
      .number()
      .finite("medium must be a finite number")
      .min(0, "medium must be between 0 and 100")
      .max(100, "medium must be between 0 and 100"),
    hard: z
      .number()
      .finite("hard must be a finite number")
      .min(0, "hard must be between 0 and 100")
      .max(100, "hard must be between 0 and 100"),
  })
  .refine(
    (d) => d.easy + d.medium + d.hard === 100,
    "difficultyDistribution must total 100",
  );

export type DifficultyDistribution = z.infer<typeof difficultyDistributionSchema>;

const scopeRefinements = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema
    .refine(
      (data) =>
        data.contentScope !== "CHAPTER" ||
        (data.lessonIds as string[]).length === 0,
      {
        message: "lessonIds must be empty when contentScope is CHAPTER",
        path: ["lessonIds"],
      },
    )
    .refine(
      (data) =>
        data.contentScope !== "SELECTED_LESSONS" ||
        (data.lessonIds as string[]).length >= 1,
      {
        message:
          "lessonIds must contain at least one lesson when contentScope is SELECTED_LESSONS",
        path: ["lessonIds"],
      },
    )
    .refine(
      (data) =>
        (data.questionCount as number) >= new Set(data.types as string[]).size,
      {
        message:
          "questionCount must be at least the number of selected question types",
        path: ["questionCount"],
      },
    );

const chapterIdsField = z
  .array(uuid)
  .optional()
  .refine(
    (ids) => ids === undefined || new Set(ids).size === ids.length,
    "chapterIds must not contain duplicates",
  );

const generateQuizBaseSchema = z.object({
  // Optional so MULTI_CHAPTER / FULL_CURRICULUM requests need not supply it.
  // Required for SINGLE_CHAPTER — enforced by the union-level refinement below.
  chapterId: uuid.optional(),
  // Source scope of the generation content. Omitted => SINGLE_CHAPTER (legacy).
  sourceScope: z.enum(SOURCE_SCOPES).optional(),
  chapterIds: chapterIdsField,
  stageId: uuid.optional(),
  contentScope: z.enum(QUIZ_CONTENT_SCOPES),
  lessonIds: lessonIdsField,
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
  topicFocus: z
    .string()
    .trim()
    .min(1, "topicFocus must not be empty")
    .max(
      MAX_TOPIC_FOCUS_LENGTH,
      `topicFocus must not exceed ${MAX_TOPIC_FOCUS_LENGTH} characters`,
    )
    .optional(),
});

const scopedBaseSchema = scopeRefinements(generateQuizBaseSchema);

const singleDifficultySchema = scopedBaseSchema
  .extend({
    difficultyMode: z.literal("SINGLE"),
    difficulty: z.enum(DIFFICULTIES),
  })
  .strict();

const mixedDifficultySchema = scopedBaseSchema
  .extend({
    difficultyMode: z.literal("MIXED"),
    difficultyDistribution: difficultyDistributionSchema,
  })
  .strict();

export const generateQuizSchema = z
  .discriminatedUnion("difficultyMode", [
    singleDifficultySchema,
    mixedDifficultySchema,
  ])
  .superRefine((data, ctx) => {
    const scope: SourceScope = data.sourceScope ?? "SINGLE_CHAPTER";

    if (scope === "SINGLE_CHAPTER") {
      if (!data.chapterId) {
        ctx.addIssue({
          code: "custom",
          path: ["chapterId"],
          message: "chapterId is required for SINGLE_CHAPTER generation",
        });
      }
      return;
    }

    // MULTI_CHAPTER / FULL_CURRICULUM draw from whole chapters only; per-lesson
    // selection is a single-chapter concept.
    if (data.contentScope !== "CHAPTER") {
      ctx.addIssue({
        code: "custom",
        path: ["contentScope"],
        message: "Multi-chapter and full-curriculum generation require contentScope CHAPTER",
      });
    }

    if (scope === "MULTI_CHAPTER") {
      const ids = data.chapterIds ?? [];
      if (ids.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["chapterIds"],
          message: "MULTI_CHAPTER requires at least two chapters",
        });
      }
    } else if (scope === "FULL_CURRICULUM") {
      if (!data.stageId) {
        ctx.addIssue({
          code: "custom",
          path: ["stageId"],
          message: "stageId is required for FULL_CURRICULUM generation",
        });
      }
    }
  });

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
