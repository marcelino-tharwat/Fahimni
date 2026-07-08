import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminTeacherDetailApi } from '@/features/admin/api/adminTeacherDetail';
import type { EnrollmentStatus } from '@/features/admin/types/teacherDetail';

const KEY = ['admin', 'teacher-detail'] as const;

/** Teacher header/detail (identity, profile, stats, subscription, revenue). */
export function useAdminTeacherDetail(teacherId: string) {
  return useQuery({
    queryKey: [...KEY, teacherId],
    queryFn: () => adminTeacherDetailApi.getDetail(teacherId),
    enabled: !!teacherId,
  });
}

export function useAdminTeacherStudents(
  teacherId: string,
  params: { page: number; limit: number; q?: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'students', params],
    queryFn: () => adminTeacherDetailApi.getStudents(teacherId, params),
    enabled: enabled && !!teacherId,
    placeholderData: keepPreviousData,
  });
}

export function useAdminTeacherEnrollments(
  teacherId: string,
  params: { page: number; limit: number; status?: EnrollmentStatus },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'enrollments', params],
    queryFn: () => adminTeacherDetailApi.getEnrollments(teacherId, params),
    enabled: enabled && !!teacherId,
    placeholderData: keepPreviousData,
  });
}

export function useAdminTeacherContent(teacherId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'content'],
    queryFn: () => adminTeacherDetailApi.getContent(teacherId),
    enabled: enabled && !!teacherId,
  });
}

export function useAdminTeacherRevenue(teacherId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'revenue'],
    queryFn: () => adminTeacherDetailApi.getRevenue(teacherId),
    enabled: enabled && !!teacherId,
  });
}

export function useAdminTeacherSubscription(teacherId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'subscription'],
    queryFn: () => adminTeacherDetailApi.getSubscription(teacherId),
    enabled: enabled && !!teacherId,
  });
}

export function useAdminTeacherAiUsage(teacherId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, teacherId, 'ai-usage'],
    queryFn: () => adminTeacherDetailApi.getAiUsage(teacherId),
    enabled: enabled && !!teacherId,
  });
}
