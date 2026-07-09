import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminPlanQuery,
  AdminPlansListResponse,
  AdminPlanDetail,
  CreatePlanInput,
  UpdatePlanInput,
  StatusChangeInput,
  RecommendedChangeInput,
  ReorderInput,
  PlanMutationResponse,
} from '@/features/admin/types/plans';

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

  create: async (input: CreatePlanInput): Promise<PlanMutationResponse> => {
    const { data } = await apiClient.post<ApiResponse<PlanMutationResponse>>(
      '/admin/plans',
      input,
    );
    return data.data;
  },

  update: async (planId: string, input: UpdatePlanInput): Promise<PlanMutationResponse> => {
    const { data } = await apiClient.patch<ApiResponse<PlanMutationResponse>>(
      `/admin/plans/${planId}`,
      input,
    );
    return data.data;
  },

  changeStatus: async (planId: string, input: StatusChangeInput): Promise<PlanMutationResponse> => {
    const { data } = await apiClient.patch<ApiResponse<PlanMutationResponse>>(
      `/admin/plans/${planId}/status`,
      input,
    );
    return data.data;
  },

  changeRecommended: async (planId: string, input: RecommendedChangeInput): Promise<PlanMutationResponse> => {
    const { data } = await apiClient.patch<ApiResponse<PlanMutationResponse>>(
      `/admin/plans/${planId}/recommended`,
      input,
    );
    return data.data;
  },

  reorder: async (input: ReorderInput): Promise<PlanMutationResponse[]> => {
    const { data } = await apiClient.patch<ApiResponse<PlanMutationResponse[]>>(
      '/admin/plans/reorder',
      input,
    );
    return data.data;
  },
};
