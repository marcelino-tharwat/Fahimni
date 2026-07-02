import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  essayGradingApi,
  essayGradingKeys,
} from '@/features/teacher/api/essayGrading';
import type { GradeEssaysPayload } from '@/features/teacher/types/essayGrading';

export function useEssayGradingHub() {
  return useQuery({
    queryKey: essayGradingKeys.hub(),
    queryFn: () => essayGradingApi.getHub(),
  });
}

export function useEssaySubmissions(quizId: string) {
  return useQuery({
    queryKey: essayGradingKeys.submissions(quizId),
    queryFn: () => essayGradingApi.getSubmissions(quizId),
    enabled: Boolean(quizId),
  });
}

export function useEssayGradingDetail(attemptId: string) {
  return useQuery({
    queryKey: essayGradingKeys.detail(attemptId),
    queryFn: () => essayGradingApi.getDetail(attemptId),
    enabled: Boolean(attemptId),
  });
}

export function useGradeEssays(attemptId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GradeEssaysPayload) =>
      essayGradingApi.gradeEssays(attemptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: essayGradingKeys.hub() });
      queryClient.invalidateQueries({ queryKey: essayGradingKeys.submissions(quizId) });
      queryClient.invalidateQueries({ queryKey: essayGradingKeys.detail(attemptId) });
    },
  });
}
