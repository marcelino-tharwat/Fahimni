import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { TeacherDashboardStats } from '@/features/teacher/types/dashboard';

/**
 * Teacher dashboard stats endpoint.
 *
 * Backend route (mounted at `/api/dashboard`, see backend/src/app.ts):
 *   GET /dashboard/teacher/stats   -> { success, message, data }
 *
 * Teacher-only (OPERATION role); the teacher identity comes from the JWT, so no
 * id is sent from the client.
 */
export const teacherDashboardApi = {
  getStats: async (): Promise<TeacherDashboardStats> => {
    const { data } = await apiClient.get<ApiResponse<TeacherDashboardStats>>(
      '/dashboard/teacher/stats',
    );
    return data.data;
  },
};
