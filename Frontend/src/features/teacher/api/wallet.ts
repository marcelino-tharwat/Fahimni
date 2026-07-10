import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  PayoutProfile,
  TeacherWallet,
  UpdatePayoutProfileInput,
} from '@/features/teacher/types/wallet';

/**
 * Teacher wallet / payout-profile endpoints.
 *
 * Backend routes (mounted at `/api/teacher`, see backend/src/app.ts):
 *   GET   /teacher/wallet
 *   GET   /teacher/payout-profile
 *   PATCH /teacher/payout-profile
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
};
