import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types/api';

export type IndexStatusValue = 'pending' | 'indexing' | 'ready' | 'failed';

export interface IndexStatus {
  lessonId: string;
  status: IndexStatusValue;
  chunkCount: number;
}

/**
 * Content (RAG) indexing API — STORY-43 endpoints, teacher-only.
 * Indexing chunks + embeds the lesson text so STORY-45 quiz generation has
 * source content to ground questions on.
 */
export const contentIndexingApi = {
  /** GET /api/ai/status/:lessonId — current indexing state for one lesson. */
  getStatus: async (lessonId: string): Promise<IndexStatus> => {
    const { data } = await apiClient.get<ApiResponse<IndexStatus>>(`/ai/status/${lessonId}`);
    return data.data;
  },

  /** POST /api/ai/index/:lessonId — chunk + embed + store the lesson text. */
  indexLesson: async (
    lessonId: string,
    pdfText: string,
  ): Promise<{ lessonId: string; status: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ lessonId: string; status: string }>>(
      `/ai/index/${lessonId}`,
      { pdfText },
    );
    return data.data;
  },
};
