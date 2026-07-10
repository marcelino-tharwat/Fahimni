import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherWalletApi } from '@/features/teacher/api/wallet';

export const TEACHER_WALLET_KEY = ['teacher', 'wallet'] as const;

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
