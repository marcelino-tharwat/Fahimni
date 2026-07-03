import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizGenerationApi } from '@/features/teacher/api/quizGeneration';

export function useQuizResults(quizId: string) {
  return useQuery({
    queryKey: ['teacher', 'quizResults', quizId],
    queryFn: () => quizGenerationApi.getQuizResults(quizId),
    enabled: Boolean(quizId),
  });
}

export function useExportResults(quizId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const blob = await quizGenerationApi.getQuizResultsExport(quizId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-${quizId}-results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'quizResults', quizId] });
    },
  });
}
