import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminTeachersQuery,
  AdminTeachersResponse,
} from '@/features/admin/types/teachers';

/**
 * Admin Teachers Management list. `apiClient.baseURL` already includes `/api`,
 * so the path is `/admin/teachers`. Response uses the `{ message, data }`
 * envelope where `data` is `{ data: AdminTeacher[], meta }`.
 */
export const adminTeachersApi = {
  list: async (query: AdminTeachersQuery): Promise<AdminTeachersResponse> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.status) params.status = query.status;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sort) params.sort = query.sort;

    const { data } = await apiClient.get<ApiResponse<AdminTeachersResponse>>(
      '/admin/teachers',
      { params },
    );
    return data.data;
  },
};
