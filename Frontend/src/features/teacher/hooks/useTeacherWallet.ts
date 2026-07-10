import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherWalletApi } from '@/features/teacher/api/wallet';

export const TEACHER_WALLET_KEY = ['teacher', 'wallet'] as const;
export const TEACHER_WITHDRAWALS_KEY = ['teacher', 'withdrawals'] as const;

export function useTeacherWallet() {
  return useQuery({
    queryKey: TEACHER_WALLET_KEY,
    queryFn: teacherWalletApi.getWallet,
  });
}

export function useUpdatePayoutProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherWalletApi.updatePayoutProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_WALLET_KEY });
    },
  });
}

export function useTeacherWithdrawals() {
  return useQuery({
    queryKey: TEACHER_WITHDRAWALS_KEY,
    queryFn: teacherWalletApi.listWithdrawals,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherWalletApi.createWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_WALLET_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_WITHDRAWALS_KEY });
    },
  });
}

export function useCancelWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherWalletApi.cancelWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_WALLET_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_WITHDRAWALS_KEY });
    },
  });
}
