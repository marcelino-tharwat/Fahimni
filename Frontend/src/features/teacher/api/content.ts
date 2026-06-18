import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { StageResponseDTO } from '@/features/teacher/types/stage';

export const teacherContentApi = {
  getStages: async (): Promise<StageResponseDTO[]> => {
    const { data } = await apiClient.get<ApiResponse<StageResponseDTO[]>>('/stages');
    return data.data;
  },
};
