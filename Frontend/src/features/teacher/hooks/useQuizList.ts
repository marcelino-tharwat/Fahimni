import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizGenerationApi } from '@/features/teacher/api/quizGeneration';
import type { QuizListItem, UpdateQuizBody } from '@/features/teacher/api/quizGeneration';

export const QUIZ_LIST_KEY = ['teacher', 'quizzes'] as const;

export function useQuizList(status?: string) {
  return useQuery({
    queryKey: [...QUIZ_LIST_KEY, status],
    queryFn: () => quizGenerationApi.listQuizzes(status),
  });
}

export function usePublishQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => quizGenerationApi.publishQuiz(quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIZ_LIST_KEY }),
  });
}

export function useAssignQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, chapterId }: { quizId: string; chapterId: string }) =>
      quizGenerationApi.assignQuiz(quizId, chapterId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIZ_LIST_KEY }),
  });
}

export function useUnpublishQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => quizGenerationApi.unpublishQuiz(quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIZ_LIST_KEY }),
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => quizGenerationApi.deleteQuiz(quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIZ_LIST_KEY }),
  });
}

export function useUpdateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, body }: { quizId: string; body: UpdateQuizBody }) =>
      quizGenerationApi.updateQuiz(quizId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIZ_LIST_KEY }),
  });
}
