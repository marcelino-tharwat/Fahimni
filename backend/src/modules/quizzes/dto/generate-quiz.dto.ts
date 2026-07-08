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

/**
 * How the total questionCount is spread across the resolved source.
 *  - AUTO       → a single grounded generation pass over all resolved content
 *                 (byte-for-byte the legacy behavior; distribution is implicit).
 *  - BY_CHAPTER → the teacher fixes a question count per selected chapter
 *                 (MULTI_CHAPTER only). One grounded pass per chapter.
 *  - BY_LESSON  → the teacher fixes a question count per selected lesson
 *                 (SINGLE_CHAPTER or MULTI_CHAPTER). One grounded pass per lesson.
 * Omitted ⇒ AUTO, so legacy requests keep working unchanged.
 */
export const ALLOCATION_MODES = ["AUTO", "BY_CHAPTER", "BY_LESSON"] as const;
export type AllocationMode = (typeof ALLOCATION_MODES)[number];

/**
 * Safety bound on how many independent generation passes a single request may
 * fan out into (one pass per allocation bucket). Keeps the operation inside the
 * total generation budget and avoids provider rate-limit storms. A plan with
 * more buckets is rejected with a clear 400 (use BY_CHAPTER or fewer lessons).
 */
export const MAX_ALLOCATION_BUCKETS = 12;

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

/** Per-lesson question allocation. `questionCount` must be a positive integer. */
export const lessonAllocationSchema = z.object({
  lessonId: uuid,
  questionCount: z
    .number()
    .int("lesson questionCount must be an integer")
    .min(1, "lesson questionCount must be greater than zero")
    .max(MAX_QUESTION_COUNT, `lesson questionCount must not exceed ${MAX_QUESTION_COUNT}`),
});
export type LessonAllocationInput = z.infer<typeof lessonAllocationSchema>;

/**
 * Per-chapter question allocation. For BY_CHAPTER the `questionCount` is the
 * chapter total. For BY_LESSON the chapter total is derived from its
 * `lessonAllocations`, so `questionCount` may be omitted.
 */
export const chapterAllocationSchema = z.object({
  chapterId: uuid,
  questionCount: z
    .number()
    .int("chapter questionCount must be an integer")
    .min(1, "chapter questionCount must be greater than zero")
    .max(MAX_QUESTION_COUNT, `chapter questionCount must not exceed ${MAX_QUESTION_COUNT}`)
    .optional(),
  lessonAllocations: z
    .array(lessonAllocationSchema)
    .optional()
    .refine(
      (rows) =>
        rows === undefined ||
        new Set(rows.map((r) => r.lessonId)).size === rows.length,
      "lessonAllocations must not contain duplicate lessons",
    ),
});
export type ChapterAllocationInput = z.infer<typeof chapterAllocationSchema>;

const generateQuizBaseSchema = z.object({
  // Optional so MULTI_CHAPTER / FULL_CURRICULUM requests need not supply it.
  // Required for SINGLE_CHAPTER — enforced by the union-level refinement below.
  chapterId: uuid.optional(),
  // Source scope of the generation content. Omitted => SINGLE_CHAPTER (legacy).
  sourceScope: z.enum(SOURCE_SCOPES).optional(),
  // Allocation of the total questionCount across the source. Omitted ⇒ AUTO.
  allocationMode: z.enum(ALLOCATION_MODES).optional(),
  chapterIds: chapterIdsField,
  chapterAllocations: z
    .array(chapterAllocationSchema)
    .optional()
    .refine(
      (rows) =>
        rows === undefined ||
        new Set(rows.map((r) => r.chapterId)).size === rows.length,
      "chapterAllocations must not contain duplicate chapters",
    ),
  lessonAllocations: z.array(lessonAllocationSchema).optional(),
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
    } else {
      // MULTI_CHAPTER / FULL_CURRICULUM draw from whole chapters only; per-lesson
      // *content scope* selection is a single-chapter concept (BY_LESSON
      // allocation is expressed via chapterAllocations, not contentScope).
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
    }

    validateAllocation(scope, data, ctx);
  });

/**
 * Cross-field validation of the allocation controls. Shape (types, positivity,
 * duplicate ids) is enforced by the field schemas above; here we enforce the
 * mode/scope compatibility and that the per-bucket counts sum to questionCount.
 * Ownership and content-eligibility are validated server-side by the allocation
 * service (they need database access).
 */
function validateAllocation(
  scope: SourceScope,
  data: {
    allocationMode?: AllocationMode | undefined;
    questionCount: number;
    chapterIds?: string[] | undefined;
    chapterAllocations?: ChapterAllocationInput[] | undefined;
    lessonAllocations?: LessonAllocationInput[] | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const mode: AllocationMode = data.allocationMode ?? "AUTO";
  const chapterAllocations = data.chapterAllocations ?? [];
  const lessonAllocations = data.lessonAllocations ?? [];

  if (mode === "AUTO") {
    if (chapterAllocations.length > 0 || lessonAllocations.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["allocationMode"],
        message: "AUTO allocation must not include chapterAllocations or lessonAllocations",
      });
    }
    return;
  }

  if (scope === "FULL_CURRICULUM") {
    ctx.addIssue({
      code: "custom",
      path: ["allocationMode"],
      message: "Full-curriculum generation supports AUTO allocation only",
    });
    return;
  }

  if (mode === "BY_CHAPTER") {
    if (scope !== "MULTI_CHAPTER") {
      ctx.addIssue({
        code: "custom",
        path: ["allocationMode"],
        message: "BY_CHAPTER allocation is only valid for MULTI_CHAPTER generation",
      });
      return;
    }
    if (chapterAllocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["chapterAllocations"],
        message: "BY_CHAPTER allocation requires chapterAllocations",
      });
      return;
    }
    let total = 0;
    for (let i = 0; i < chapterAllocations.length; i += 1) {
      const alloc = chapterAllocations[i]!;
      if (alloc.questionCount === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["chapterAllocations", i, "questionCount"],
          message: "questionCount is required for each chapter in BY_CHAPTER allocation",
        });
        return;
      }
      total += alloc.questionCount;
    }
    if (total !== data.questionCount) {
      ctx.addIssue({
        code: "custom",
        path: ["questionCount"],
        message: `Sum of chapter allocations (${total}) must equal questionCount (${data.questionCount})`,
      });
    }
    return;
  }

  // mode === "BY_LESSON"
  if (scope === "SINGLE_CHAPTER") {
    if (lessonAllocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["lessonAllocations"],
        message: "BY_LESSON allocation requires lessonAllocations",
      });
      return;
    }
    const total = lessonAllocations.reduce((s, r) => s + r.questionCount, 0);
    if (total !== data.questionCount) {
      ctx.addIssue({
        code: "custom",
        path: ["questionCount"],
        message: `Sum of lesson allocations (${total}) must equal questionCount (${data.questionCount})`,
      });
    }
    return;
  }

  // MULTI_CHAPTER + BY_LESSON: every chapter carries its own lessonAllocations.
  if (chapterAllocations.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["chapterAllocations"],
      message: "BY_LESSON allocation for multiple chapters requires chapterAllocations",
    });
    return;
  }
  let total = 0;
  for (let i = 0; i < chapterAllocations.length; i += 1) {
    const rows = chapterAllocations[i]!.lessonAllocations ?? [];
    if (rows.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["chapterAllocations", i, "lessonAllocations"],
        message: "Each chapter must include at least one lesson allocation in BY_LESSON mode",
      });
      return;
    }
    total += rows.reduce((s, r) => s + r.questionCount, 0);
  }
  if (total !== data.questionCount) {
    ctx.addIssue({
      code: "custom",
      path: ["questionCount"],
      message: `Sum of lesson allocations (${total}) must equal questionCount (${data.questionCount})`,
    });
  }
}

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
