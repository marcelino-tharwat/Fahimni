import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminStudentsApi } from '@/features/admin/api/adminStudents';
import type { AdminStudentsQuery } from '@/features/admin/types/students';

const KEY = ['admin', 'students'] as const;

export function useAdminStudents(query: AdminStudentsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminStudentsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminStudentDetail(studentId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', studentId],
    queryFn: () => adminStudentsApi.getDetail(studentId as string),
    enabled: !!studentId,
  });
}

export function useAdminStudentEnrollments(studentId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'enrollments', studentId],
    queryFn: () => adminStudentsApi.getEnrollments(studentId as string, { page: 1, limit: 50 }),
    enabled: !!studentId,
  });
}

export function useAdminStudentPayments(studentId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'payments', studentId],
    queryFn: () => adminStudentsApi.getPayments(studentId as string),
    enabled: !!studentId,
  });
}

export function useAdminStudentLearning(studentId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'learning', studentId],
    queryFn: () => adminStudentsApi.getLearningSummary(studentId as string),
    enabled: !!studentId,
  });
}
