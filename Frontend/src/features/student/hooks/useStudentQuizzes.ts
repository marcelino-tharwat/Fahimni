import { useQuery } from '@tanstack/react-query';
import { quizApi } from '@/features/student/api/quiz';

export const STUDENT_QUIZZES_KEY = ['student', 'quizzes'] as const;

export function useStudentQuizzes() {
  return useQuery({
    queryKey: STUDENT_QUIZZES_KEY,
    queryFn: async () => {
      const { data } = await quizApi.getStudentQuizzes();
      return data.data;
    },
    refetchOnMount: 'always',
    retry: 2,
  });
}
