import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types/api';
import type {
  EssayGradingDetail,
  EssayGradingHubResponse,
  EssaySubmissionsResponse,
  EssaySuggestionsResponse,
  GradeEssaysPayload,
} from '@/features/teacher/types/essayGrading';

export const essayGradingKeys = {
  all: ['essay-grading'] as const,
  hub: () => [...essayGradingKeys.all, 'hub'] as const,
  submissions: (quizId: string) =>
    [...essayGradingKeys.all, 'submissions', quizId] as const,
  detail: (attemptId: string) =>
    [...essayGradingKeys.all, 'detail', attemptId] as const,
};

export const essayGradingApi = {
  getHub: async (params?: { cursor?: string; limit?: number }): Promise<EssayGradingHubResponse> => {
    const { data } = await apiClient.get<ApiResponse<EssayGradingHubResponse>>(
      '/quizzes/essay-grading',
      { params },
    );
    return data.data;
  },

  getSubmissions: async (
    quizId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<EssaySubmissionsResponse> => {
    const { data } = await apiClient.get<ApiResponse<EssaySubmissionsResponse>>(
      `/quizzes/${quizId}/essay-submissions`,
      { params },
    );
    return data.data;
  },

  getDetail: async (attemptId: string): Promise<EssayGradingDetail> => {
    const { data } = await apiClient.get<ApiResponse<EssayGradingDetail>>(
      `/attempts/${attemptId}/essay-grading`,
    );
    return data.data;
  },

  gradeEssays: async (attemptId: string, payload: GradeEssaysPayload) => {
    const { data } = await apiClient.patch<ApiResponse<unknown>>(
      `/attempts/${attemptId}/grade-essays`,
      payload,
    );
    return data.data;
  },

  generateSuggestions: async (attemptId: string): Promise<EssaySuggestionsResponse> => {
    const { data } = await apiClient.post<ApiResponse<EssaySuggestionsResponse>>(
      `/attempts/${attemptId}/essay-suggestions`,
    );
    return data.data;
  },
};
