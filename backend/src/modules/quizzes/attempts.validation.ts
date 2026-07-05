import { z } from "zod";

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

const MAX_ANSWER_LENGTH = 5000;
const MAX_FEEDBACK_LENGTH = 2000;

const answerEntrySchema = z
  .object({
    questionId: uuid,
    answer: z
      .string()
      .trim()
      .min(1, "Answer must not be blank")
      .max(MAX_ANSWER_LENGTH, "Answer is too long"),
  })
  .strict();

const draftAnswerEntrySchema = z
  .object({
    questionId: uuid,
    answer: z.string().max(MAX_ANSWER_LENGTH, "Answer is too long"),
  })
  .strict();

/** POST /api/attempts/:attemptId/submit */
export const submitAttemptSchema = z
  .object({
    answers: z
      .array(answerEntrySchema)
      .default([])
      .refine(
        (arr) => new Set(arr.map((a) => a.questionId)).size === arr.length,
        "Duplicate question IDs are not allowed",
      ),
    submissionReason: z.enum(["MANUAL", "TIME_EXPIRED"]).optional(),
  })
  .strict();

/** PATCH /api/attempts/:attemptId/answers — persist draft answers while in progress. */
export const saveDraftAnswersSchema = z
  .object({
    answers: z
      .array(draftAnswerEntrySchema)
      .nonempty("answers must contain at least one entry")
      .refine(
        (arr) => new Set(arr.map((a) => a.questionId)).size === arr.length,
        "Duplicate question IDs are not allowed",
      ),
  })
  .strict();

/** POST /api/attempts/:attemptId/grade-essays */
export const gradeEssaysSchema = z
  .object({
    grades: z
      .array(
        z
          .object({
            questionId: uuid,
            awardedPoints: z
              .number()
              .finite()
              .min(0, "awardedPoints must be >= 0"),
            feedback: z
              .string()
              .trim()
              .max(MAX_FEEDBACK_LENGTH, "Feedback is too long")
              .optional(),
          })
          .strict(),
      )
      .nonempty("grades must contain at least one entry")
      .refine(
        (arr) => new Set(arr.map((g) => g.questionId)).size === arr.length,
        "Duplicate question IDs are not allowed",
      ),
  })
  .strict();

/** GET /api/quizzes/:quizId/results — sort controls (STORY-68). */
export const resultsQuerySchema = z
  .object({
    sortBy: z.enum(["score", "studentName"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strip();

const essayListLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .optional();

/** Cursor pagination for essay-grading list endpoints. */
export const essayGradingListQuerySchema = z
  .object({
    cursor: uuid.optional(),
    limit: essayListLimit,
  })
  .strip();

/** PUT /api/quizzes/:id/result-settings — teacher result-visibility settings. */
export const PENDING_ESSAY_RESULT_MODES = [
  "HIDE_ALL_RESULTS",
  "SHOW_OBJECTIVE_ONLY",
  "SHOW_OBJECTIVE_WITH_PENDING_MESSAGE",
] as const;

export const resultSettingsSchema = z
  .object({
    showCorrectAnswers: z.boolean().optional(),
    showPerQuestionScores: z.boolean().optional(),
    showFinalScore: z.boolean().optional(),
    showStudentAnswers: z.boolean().optional(),
    showExplanations: z.boolean().optional(),
    pendingEssayResultMode: z.enum(PENDING_ESSAY_RESULT_MODES).optional(),
  })
  .strict();

export type ResultSettingsInput = z.infer<typeof resultSettingsSchema>;

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type SaveDraftAnswersInput = z.infer<typeof saveDraftAnswersSchema>;
export type GradeEssaysInput = z.infer<typeof gradeEssaysSchema>;
export type ResultsQueryInput = z.infer<typeof resultsQuerySchema>;
export type EssayGradingListQueryInput = z.infer<typeof essayGradingListQuerySchema>;
