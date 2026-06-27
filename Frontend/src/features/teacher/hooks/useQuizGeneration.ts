import { useQuery, useMutation } from '@tanstack/react-query';
import { quizGenerationApi } from '@/features/teacher/api/quizGeneration';
import type { GenerateQuizPayload } from '@/features/teacher/types/quizGeneration';

export const STAGES_KEY = ['teacher', 'stages'];
export const CHAPTERS_KEY = ['teacher', 'chapters'];
export const LESSONS_KEY = ['teacher', 'lessons'];

export function useStagesList() {
  return useQuery({
    queryKey: STAGES_KEY,
    queryFn: () => quizGenerationApi.getStages(),
  });
}

export function useChaptersByStage(stageId: string | undefined) {
  return useQuery({
    queryKey: [...CHAPTERS_KEY, stageId],
    queryFn: () => quizGenerationApi.getChaptersByStage(stageId!),
    enabled: !!stageId,
  });
}

export function useLessonsByChapter(chapterId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, chapterId],
    queryFn: () => quizGenerationApi.getLessonsByChapter(chapterId!),
    enabled: !!chapterId,
  });
}

export function useGenerateQuiz() {
  return useMutation({
    mutationFn: (payload: GenerateQuizPayload) => quizGenerationApi.generateQuiz(payload),
  });
}
