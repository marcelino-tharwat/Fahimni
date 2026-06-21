import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  CreateStagePayload,
  StageResponseDTO,
  UpdateStagePayload,
} from '@/features/teacher/types/stage';
import type { ContentTreeStage } from '@/features/teacher/types/contentTree';

/**
 * Raw (nested) shape returned by `GET /api/content/tree`
 * (backend/src/modules/content/content.controller.ts). When the teacher has
 * no content, the endpoint returns a diagnostics object instead of an array —
 * hence the `Array.isArray` guard in `getContentTree`.
 */
interface RawContentTreeNode {
  stage: { id: string; name: string; sortOrder: number; chapterCount: number };
  chapters: {
    chapter: { id: string; name: string; sortOrder: number; lessonCount: number };
    lessons: { id: string; title: string; sortOrder: number }[];
  }[];
}

export const teacherContentApi = {
  getStages: async (): Promise<StageResponseDTO[]> => {
    const { data } = await apiClient.get<ApiResponse<StageResponseDTO[]>>('/stages');
    return data.data;
  },

  getStage: async (id: string): Promise<StageResponseDTO> => {
    const { data } = await apiClient.get<ApiResponse<StageResponseDTO>>(`/stages/${id}`);
    return data.data;
  },

  createStage: async (payload: CreateStagePayload): Promise<StageResponseDTO> => {
    const { data } = await apiClient.post<ApiResponse<StageResponseDTO>>('/stages', payload);
    return data.data;
  },

  updateStage: async (
    id: string,
    payload: UpdateStagePayload,
  ): Promise<StageResponseDTO> => {
    const { data } = await apiClient.put<ApiResponse<StageResponseDTO>>(
      `/stages/${id}`,
      payload,
    );
    return data.data;
  },

  deleteStage: async (id: string, force = false): Promise<void> => {
    await apiClient.delete(`/stages/${id}${force ? '?force=true' : ''}`);
  },

  // NOTE: `/content/tree` returns a *raw* array (no { success, message, data }
  // envelope), and a diagnostics object when there is no content. We guard with
  // Array.isArray and flatten the nested nodes into the ContentTreeStage shape.
  reorderStages: async (ids: string[]): Promise<StageResponseDTO[]> => {
    const { data } = await apiClient.patch<ApiResponse<StageResponseDTO[]>>(
      '/stages/reorder',
      ids,
    );
    return data.data;
  },

  getContentTree: async (): Promise<ContentTreeStage[]> => {
    const { data } = await apiClient.get<RawContentTreeNode[] | unknown>('/content/tree');

    if (!Array.isArray(data)) return [];

    return (data as RawContentTreeNode[]).map((node) => ({
      ...node.stage,
      chapters: node.chapters.map((c) => ({
        ...c.chapter,
        lessons: c.lessons,
      })),
    }));
  },
};
