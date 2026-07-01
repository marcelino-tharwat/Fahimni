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

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type SaveDraftAnswersInput = z.infer<typeof saveDraftAnswersSchema>;
export type GradeEssaysInput = z.infer<typeof gradeEssaysSchema>;
export type ResultsQueryInput = z.infer<typeof resultsQuerySchema>;
