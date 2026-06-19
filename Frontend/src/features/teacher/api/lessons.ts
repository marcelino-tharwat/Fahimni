import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  Lesson,
  CreateLessonPayload,
  UpdateLessonPayload,
} from '@/features/teacher/types/lesson';

/**
 * Lesson endpoints (axios baseURL already includes `/api`).
 *
 *   GET    /chapters/:chapterId/lessons
 *   GET    /lessons/:id
 *   POST   /chapters/:chapterId/lessons
 *   PUT    /lessons/:id
 *   DELETE /lessons/:id                       (no force needed)
 *   PATCH  /chapters/:chapterId/lessons/reorder   (body: raw string[] of ids)
 *
 * CRUD responses use the standard envelope { success, message, data };
 * we unwrap `data`. Delete returns a message only.
 */
export const lessonsApi = {
  getLessonsByChapter: async (chapterId: string): Promise<Lesson[]> => {
    const { data } = await apiClient.get<ApiResponse<Lesson[]>>(
      `/chapters/${chapterId}/lessons`,
    );
    return data.data;
  },

  getLesson: async (id: string): Promise<Lesson> => {
    const { data } = await apiClient.get<ApiResponse<Lesson>>(`/lessons/${id}`);
    return data.data;
  },

  createLesson: async (
    chapterId: string,
    payload: CreateLessonPayload,
  ): Promise<Lesson> => {
    const { data } = await apiClient.post<ApiResponse<Lesson>>(
      `/chapters/${chapterId}/lessons`,
      payload,
    );
    return data.data;
  },

  updateLesson: async (
    id: string,
    payload: UpdateLessonPayload,
  ): Promise<Lesson> => {
    const { data } = await apiClient.put<ApiResponse<Lesson>>(
      `/lessons/${id}`,
      payload,
    );
    return data.data;
  },

  deleteLesson: async (id: string): Promise<void> => {
    await apiClient.delete(`/lessons/${id}`);
  },

  reorderLessons: async (
    chapterId: string,
    ids: string[],
  ): Promise<Lesson[]> => {
    const { data } = await apiClient.patch<ApiResponse<Lesson[]>>(
      `/chapters/${chapterId}/lessons/reorder`,
      ids,
    );
    return data.data;
  },
};
