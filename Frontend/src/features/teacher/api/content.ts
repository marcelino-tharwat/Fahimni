import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { StageResponseDTO } from '@/features/teacher/types/stage';
import type { ContentTreeStage } from '@/features/teacher/types/contentTree';

/**
 * Raw (nested) shape returned by `GET /api/content/tree`
 * (backend/src/modules/content/content.controller.ts). When the teacher has
 * no content, the endpoint returns a diagnostics object instead of an array —
 * hence the `Array.isArray` guard in `getContentTree`.
 */
interface RawContentTreeNode {
  stage: { id: string; name: string; displayName?: string; sortOrder: number; chapterCount: number };
  chapters: {
    chapter: {
      id: string;
      name: string;
      sortOrder: number;
      lessonCount: number;
      imageUrl?: string | null;
      term: 'FIRST_TERM' | 'SECOND_TERM';
      isVisible: boolean;
    };
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
