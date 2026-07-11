import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  CreateWithdrawalInput,
  PayoutProfile,
  TeacherWallet,
  TeacherWithdrawalListItem,
  UpdatePayoutProfileInput,
} from '@/features/teacher/types/wallet';

/**
 * Teacher wallet / payout-profile / withdrawal endpoints.
 *
 * Backend routes (mounted at `/api/teacher`, see backend/src/app.ts):
 *   GET   /teacher/wallet
 *   GET   /teacher/payout-profile
 *   PATCH /teacher/payout-profile
 *   GET   /teacher/withdrawals
 *   POST  /teacher/withdrawals
 *   PATCH /teacher/withdrawals/:withdrawalId/cancel
 *
 * Each returns the standard envelope: { success, message, data }.
 */
export const teacherWalletApi = {
  getWallet: async (): Promise<TeacherWallet> => {
    const { data } = await apiClient.get<ApiResponse<TeacherWallet>>('/teacher/wallet');
    return data.data;
  },

  getPayoutProfile: async (): Promise<PayoutProfile> => {
    const { data } = await apiClient.get<ApiResponse<PayoutProfile>>(
      '/teacher/payout-profile',
    );
    return data.data;
  },

  updatePayoutProfile: async (
    input: UpdatePayoutProfileInput,
  ): Promise<PayoutProfile> => {
    const { data } = await apiClient.patch<ApiResponse<PayoutProfile>>(
      '/teacher/payout-profile',
      input,
    );
    return data.data;
  },

  listWithdrawals: async (): Promise<TeacherWithdrawalListItem[]> => {
    const { data } = await apiClient.get<ApiResponse<TeacherWithdrawalListItem[]>>(
      '/teacher/withdrawals',
    );
    return data.data;
  },

  createWithdrawal: async (
    input: CreateWithdrawalInput,
  ): Promise<TeacherWithdrawalListItem> => {
    const { data } = await apiClient.post<ApiResponse<TeacherWithdrawalListItem>>(
      '/teacher/withdrawals',
      input,
    );
    return data.data;
  },

  cancelWithdrawal: async (withdrawalId: string): Promise<TeacherWithdrawalListItem> => {
    const { data } = await apiClient.patch<ApiResponse<TeacherWithdrawalListItem>>(
      `/teacher/withdrawals/${withdrawalId}/cancel`,
    );
    return data.data;
  },
};
