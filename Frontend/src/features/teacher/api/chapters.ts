import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  Chapter,
  CreateChapterPayload,
  UpdateChapterPayload,
} from '@/features/teacher/types/chapter';

/**
 * Chapter endpoints (backend mounts these at `/api/...`; the axios baseURL
 * already includes `/api`, so paths here are relative to that).
 *
 *   GET    /stages/:stageId/chapters
 *   GET    /chapters/:id
 *   POST   /stages/:stageId/chapters
 *   PUT    /chapters/:id
 *   DELETE /chapters/:id[?force=true]
 *   PATCH  /stages/:stageId/chapters/reorder   (body: raw string[] of ids)
 *
 * CRUD responses use the standard envelope { success, message, data };
 * we unwrap `data`. Delete returns a message only.
 */
export const chaptersApi = {
  getChaptersByStage: async (stageId: string): Promise<Chapter[]> => {
    const { data } = await apiClient.get<ApiResponse<Chapter[]>>(
      `/stages/${stageId}/chapters`,
    );
    return data.data;
  },

  getChapter: async (id: string): Promise<Chapter> => {
    const { data } = await apiClient.get<ApiResponse<Chapter>>(`/chapters/${id}`);
    return data.data;
  },

  createChapter: async (
    stageId: string,
    payload: CreateChapterPayload,
  ): Promise<Chapter> => {
    const { data } = await apiClient.post<ApiResponse<Chapter>>(
      `/stages/${stageId}/chapters`,
      payload,
    );
    return data.data;
  },

  updateChapter: async (
    id: string,
    payload: UpdateChapterPayload,
  ): Promise<Chapter> => {
    const { data } = await apiClient.put<ApiResponse<Chapter>>(
      `/chapters/${id}`,
      payload,
    );
    return data.data;
  },

  deleteChapter: async (id: string, force = false): Promise<void> => {
    await apiClient.delete(`/chapters/${id}${force ? '?force=true' : ''}`);
  },

  reorderChapters: async (
    stageId: string,
    ids: string[],
  ): Promise<Chapter[]> => {
    const { data } = await apiClient.patch<ApiResponse<Chapter[]>>(
      `/stages/${stageId}/chapters/reorder`,
      ids,
    );
    return data.data;
  },
};
