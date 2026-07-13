import { apiClient } from '@/shared/lib/api/client';
import type { StudentApiResponse } from '@/features/student/types/student';
import type { StudentProfileResponse, StageChangePolicy } from '@/features/student/types/studentProfile';

/**
 * Aggregated profile overview for the authenticated student. The backend
 * derives the student from the auth session (access-token cookie), so no id is
 * ever sent from the client.
 */
export const studentProfileOverviewApi = {
  getOverview: async (): Promise<StudentProfileResponse> => {
    const { data } = await apiClient.get<StudentApiResponse<StudentProfileResponse>>(
      '/students/me/profile',
    );
    return data.data;
  },

  getStageChangePolicy: async (): Promise<StageChangePolicy> => {
    const { data } = await apiClient.get<StudentApiResponse<StageChangePolicy>>(
      '/students/me/stage-change-policy',
    );
    return data.data;
  },

  changeStage: async (stageId: string): Promise<void> => {
    await apiClient.patch<StudentApiResponse<unknown>>('/students/me/stage', { stageId });
  },
};
