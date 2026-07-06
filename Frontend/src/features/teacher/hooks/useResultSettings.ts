import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  resultSettingsApi,
  type ResultSettings,
} from '@/features/teacher/api/resultSettings';

const RESULT_SETTINGS_KEY = ['teacher', 'result-settings'] as const;

export function useResultSettings(quizId: string | undefined) {
  return useQuery({
    queryKey: [...RESULT_SETTINGS_KEY, quizId],
    queryFn: () => resultSettingsApi.get(quizId as string),
    enabled: !!quizId,
  });
}

export function useUpdateResultSettings(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ResultSettings>) =>
      resultSettingsApi.update(quizId, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...RESULT_SETTINGS_KEY, quizId] }),
  });
}
