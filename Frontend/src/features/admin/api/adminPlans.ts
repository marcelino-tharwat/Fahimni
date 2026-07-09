import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { AdminPlanQuery, AdminPlansListResponse, AdminPlanDetail } from '@/features/admin/types/plans';

export const adminPlansApi = {
  list: async (query: AdminPlanQuery): Promise<AdminPlansListResponse> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.isActive) params.isActive = query.isActive;
    if (query.billingInterval) params.billingInterval = query.billingInterval;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sort) params.sort = query.sort;

    const { data } = await apiClient.get<ApiResponse<AdminPlansListResponse>>(
      '/admin/plans',
      { params },
    );
    return data.data;
  },

  getDetail: async (planId: string): Promise<AdminPlanDetail> => {
    const { data } = await apiClient.get<ApiResponse<AdminPlanDetail>>(
      `/admin/plans/${planId}`,
    );
    return data.data;
  },
};
