import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { AdminStats } from '@/features/admin/types/stats';

/**
 * Admin global dashboard stats. `apiClient.baseURL` already includes `/api`, so
 * the path is `/admin/stats`. Response uses the `{ message, data }` envelope, so
 * we unwrap with `data.data`.
 */
export const adminStatsApi = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await apiClient.get<ApiResponse<AdminStats>>('/admin/stats');
    return data.data;
  },
};
