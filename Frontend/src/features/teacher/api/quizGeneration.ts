import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types/api';
import type { Stage, Chapter } from '@/shared/types/content';
import type { Lesson } from '@/features/teacher/types/lesson';
import type { GenerateQuizPayload, GenerateQuizResponse } from '@/features/teacher/types/quizGeneration';

export const quizGenerationApi = {
  getStages: async (): Promise<Stage[]> => {
    const { data } = await apiClient.get<ApiResponse<Stage[]>>('/stages');
    return data.data;
  },

  getChaptersByStage: async (stageId: string): Promise<Chapter[]> => {
    const { data } = await apiClient.get<ApiResponse<Chapter[]>>(`/stages/${stageId}/chapters`);
    return data.data;
  },

  getLessonsByChapter: async (chapterId: string): Promise<Lesson[]> => {
    const { data } = await apiClient.get<ApiResponse<Lesson[]>>(`/chapters/${chapterId}/lessons`);
    return data.data;
  },

  generateQuiz: async (payload: GenerateQuizPayload): Promise<GenerateQuizResponse> => {
    const body: Record<string, unknown> = { ...payload };
    if (body.lessonIds && Array.isArray(body.lessonIds) && body.lessonIds.length > 0) {
      delete body.chapterId;
    } else {
      delete body.lessonIds;
    }
    const { data } = await apiClient.post<{ success: boolean; data: GenerateQuizResponse }>(
      '/quizzes/generate',
      body,
    );
    return data.data;
  },
};
