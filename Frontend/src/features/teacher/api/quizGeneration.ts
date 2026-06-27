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

  // ── STORY-55 / STORY-46: draft review & edit (real persistence) ─────────

  /** GET /quizzes/:id — full draft quiz with all questions. */
  getDraftQuiz: async (quizId: string): Promise<DraftQuizResponse> => {
    const { data } = await apiClient.get<ApiResponse<DraftQuizResponse>>(`/quizzes/${quizId}`);
    return data.data;
  },

  /** POST /quizzes/:id/questions — manually add a question to the draft. */
  createQuestion: async (quizId: string, body: QuestionWriteBody): Promise<DraftQuestion> => {
    const { data } = await apiClient.post<ApiResponse<DraftQuestion>>(
      `/quizzes/${quizId}/questions`,
      body,
    );
    return data.data;
  },

  /** PUT /quizzes/:id/questions/:questionId — update a question (keeps its id). */
  updateQuestion: async (
    quizId: string,
    questionId: string,
    body: Partial<QuestionWriteBody>,
  ): Promise<DraftQuestion> => {
    const { data } = await apiClient.put<ApiResponse<DraftQuestion>>(
      `/quizzes/${quizId}/questions/${questionId}`,
      body,
    );
    return data.data;
  },

  /** DELETE /quizzes/:id/questions/:questionId — remove a question. */
  deleteQuestion: async (quizId: string, questionId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}/questions/${questionId}`);
  },

  /** PATCH /quizzes/:id/questions/reorder — persist the final order (all ids). */
  reorderQuestions: async (quizId: string, orderedIds: string[]): Promise<void> => {
    await apiClient.patch(`/quizzes/${quizId}/questions/reorder`, orderedIds);
  },
};

export interface DraftQuestion {
  id: string;
  quizId: string;
  type: string;
  content: string;
  options?: unknown;
  correctAnswer?: string | number | boolean | null;
  sortOrder: number;
  points?: number;
}

export interface DraftQuizResponse {
  id: string;
  title: string;
  description?: string | null;
  chapterId: string | null;
  status: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  questions: DraftQuestion[];
}

export interface QuestionWriteBody {
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
  content: string;
  options: Record<string, string>;
  correctAnswer: string | null;
  sortOrder?: number;
}
