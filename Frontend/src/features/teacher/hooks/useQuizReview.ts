import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizGenerationApi } from '@/features/teacher/api/quizGeneration';
import type { QuestionWriteBody } from '@/features/teacher/api/quizGeneration';

export const quizReviewKey = (quizId: string) => ['teacher', 'quiz', quizId] as const;

/** Load the draft quiz + questions for Step 2 review. */
export function useDraftQuiz(quizId: string | undefined) {
  return useQuery({
    queryKey: quizReviewKey(quizId ?? ''),
    queryFn: () => quizGenerationApi.getDraftQuiz(quizId as string),
    enabled: Boolean(quizId),
  });
}

export function useCreateQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuestionWriteBody) => quizGenerationApi.createQuestion(quizId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizReviewKey(quizId) }),
  });
}

export function useUpdateQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: string; body: Partial<QuestionWriteBody> }) =>
      quizGenerationApi.updateQuestion(quizId, vars.questionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizReviewKey(quizId) }),
  });
}

export function useDeleteQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => quizGenerationApi.deleteQuestion(quizId, questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizReviewKey(quizId) }),
  });
}

export function useReorderQuestions(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => quizGenerationApi.reorderQuestions(quizId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizReviewKey(quizId) }),
  });
}
