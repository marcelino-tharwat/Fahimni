import { useQuery } from '@tanstack/react-query';
import { teacherDashboardApi } from '@/features/teacher/api/dashboard';

/**
 * Query key for the teacher dashboard stats. Exported so content mutations
 * (creating a stage/chapter/lesson, etc.) can invalidate it to refresh counts
 * and recent activity via the existing React Query strategy.
 */
export const TEACHER_DASHBOARD_STATS_KEY = ['teacher', 'dashboard', 'stats'] as const;

export function useTeacherDashboardStats() {
  return useQuery({
    queryKey: TEACHER_DASHBOARD_STATS_KEY,
    queryFn: () => teacherDashboardApi.getStats(),
  });
}
