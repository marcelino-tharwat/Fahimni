import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminTeacherRequestsApi } from '@/features/admin/api/adminTeacherRequests';
import type { TeacherRequestsQuery } from '@/features/admin/types/teacherRequests';

const KEY = ['admin', 'teacher-requests'] as const;

export function useAdminTeacherRequests(query: TeacherRequestsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminTeacherRequestsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTeacherRequestDetail(requestId: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', requestId],
    queryFn: () => adminTeacherRequestsApi.getDetail(requestId),
    enabled: !!requestId,
  });
}

export function useApproveTeacherRequest(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { adminNotes?: string; createAccount: boolean }) =>
      adminTeacherRequestsApi.approve(requestId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRejectTeacherRequest(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { adminNotes: string; rejectionMode: 'EDIT_ALLOWED' | 'FINAL_REJECTION' }) => adminTeacherRequestsApi.reject(requestId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
