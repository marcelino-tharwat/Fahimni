import { z } from 'zod';
import { validateRequest } from '../../shared/middlewares/validate.middleware.js';

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        submittedAnswer: z.string().nullable(),
      }),
    )
    .min(1, 'At least one answer is required'),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

export const validateSubmitAttempt = validateRequest(submitAttemptSchema);
