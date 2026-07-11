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
      toChapterFormData(payload),
    );
    return data.data;
  },

  updateChapter: async (
    id: string,
    payload: UpdateChapterPayload,
  ): Promise<Chapter> => {
    const { data } = await apiClient.put<ApiResponse<Chapter>>(
      `/chapters/${id}`,
      toChapterFormData(payload),
    );
    return data.data;
  },

  setVisibility: async (id: string, isVisible: boolean): Promise<Chapter> => {
    const { data } = await apiClient.patch<ApiResponse<Chapter>>(
      `/chapters/${id}/visibility`,
      { isVisible },
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

function toChapterFormData(payload: CreateChapterPayload | UpdateChapterPayload): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (key === 'image' && value instanceof File) {
      formData.append('image', value);
    } else if (key !== 'image') {
      formData.append(key, String(value));
    }
  }
  return formData;
}
