import { z } from "zod";

/**
 * STORY-64 — request body for POST /api/tutor/ask.
 *
 * Strict object (unknown fields rejected) so client-supplied identity/context
 * fields (studentId, chapterId, conversationId, history, systemPrompt, …) are
 * refused. The question is trimmed first, then length-validated (10–500 chars).
 * Student identity comes only from the authenticated token, never the body.
 */
export const askQuestionSchema = z
  .object({
    question: z
      .string({ message: "السؤال مطلوب ويجب أن يكون نصاً." })
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(10, "يجب أن يكون السؤال 10 أحرف على الأقل.")
          .max(500, "يجب ألا يتجاوز السؤال 500 حرف."),
      ),
  })
  .strict();

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
