import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminUsersResponse,
  AdminUsersQuery,
  AdminUserDetailResponse,
  AdminUserMutationResponse,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AdminChangeStatusPayload,
  AdminChangeRolePayload,
} from '@/features/admin/types/users';

export const adminUsersApi = {
  list: async (query: AdminUsersQuery): Promise<AdminUsersResponse> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.role) params.role = query.role;
    if (query.status) params.status = query.status;
    if (query.teacherApprovalState) params.teacherApprovalState = query.teacherApprovalState;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sort) params.sort = query.sort;
    const { data } = await apiClient.get<ApiResponse<AdminUsersResponse>>('/admin/users', { params });
    return data.data;
  },

  getDetail: async (userId: string): Promise<AdminUserDetailResponse> => {
    const { data } = await apiClient.get<ApiResponse<AdminUserDetailResponse>>(`/admin/users/${userId}`);
    return data.data;
  },

  createUser: async (payload: AdminCreateUserPayload): Promise<AdminUserMutationResponse> => {
    const { data } = await apiClient.post<ApiResponse<AdminUserMutationResponse>>('/admin/users', payload);
    return data.data;
  },

  updateUser: async (userId: string, payload: AdminUpdateUserPayload): Promise<AdminUserMutationResponse> => {
    const { data } = await apiClient.patch<ApiResponse<AdminUserMutationResponse>>(`/admin/users/${userId}`, payload);
    return data.data;
  },

  changeStatus: async (userId: string, payload: AdminChangeStatusPayload): Promise<AdminUserMutationResponse & { previousStatus: string }> => {
    const { data } = await apiClient.patch<ApiResponse<AdminUserMutationResponse & { previousStatus: string }>>(
      `/admin/users/${userId}/status`, payload,
    );
    return data.data;
  },

  changeRole: async (userId: string, payload: AdminChangeRolePayload): Promise<AdminUserMutationResponse & { previousRole: string }> => {
    const { data } = await apiClient.patch<ApiResponse<AdminUserMutationResponse & { previousRole: string }>>(
      `/admin/users/${userId}/role`, payload,
    );
    return data.data;
  },
};
