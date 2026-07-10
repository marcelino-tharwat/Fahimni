import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminWithdrawalListItem,
  AdminWithdrawalsQuery,
  Paginated,
  UpdateWithdrawalStatusBody,
} from '@/features/admin/types/teacherWithdrawals';

/**
 * Admin Teacher Withdrawal Requests endpoints (`apiClient.baseURL` includes `/api`).
 * Backend routes (mounted at `/api/admin`, see backend/src/modules/admin/admin.routes.ts):
 *   GET   /admin/teacher-withdrawals
 *   GET   /admin/teacher-withdrawals/:withdrawalId
 *   PATCH /admin/teacher-withdrawals/:withdrawalId/status
 */
export const adminTeacherWithdrawalsApi = {
  list: async (query: AdminWithdrawalsQuery): Promise<Paginated<AdminWithdrawalListItem>> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.status) params.status = query.status;
    if (query.teacherId) params.teacherId = query.teacherId;
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminWithdrawalListItem>>>(
      '/admin/teacher-withdrawals',
      { params },
    );
    return data.data;
  },

  getDetail: async (withdrawalId: string): Promise<AdminWithdrawalListItem> => {
    const { data } = await apiClient.get<ApiResponse<AdminWithdrawalListItem>>(
      `/admin/teacher-withdrawals/${withdrawalId}`,
    );
    return data.data;
  },

  updateStatus: async (
    withdrawalId: string,
    body: UpdateWithdrawalStatusBody,
  ): Promise<AdminWithdrawalListItem> => {
    const { data } = await apiClient.patch<ApiResponse<AdminWithdrawalListItem>>(
      `/admin/teacher-withdrawals/${withdrawalId}/status`,
      body,
    );
    return data.data;
  },
};
