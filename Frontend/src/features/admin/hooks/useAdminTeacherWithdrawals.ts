import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminTeacherWithdrawalsApi } from '@/features/admin/api/adminTeacherWithdrawals';
import type {
  AdminWithdrawalsQuery,
  UpdateWithdrawalStatusBody,
} from '@/features/admin/types/teacherWithdrawals';

const KEY = ['admin', 'teacher-withdrawals'] as const;

export function useAdminTeacherWithdrawals(query: AdminWithdrawalsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminTeacherWithdrawalsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTeacherWithdrawalDetail(withdrawalId: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', withdrawalId],
    queryFn: () => adminTeacherWithdrawalsApi.getDetail(withdrawalId),
    enabled: !!withdrawalId,
  });
}

export function useUpdateWithdrawalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      withdrawalId,
      body,
    }: {
      withdrawalId: string;
      body: UpdateWithdrawalStatusBody;
    }) => adminTeacherWithdrawalsApi.updateStatus(withdrawalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
