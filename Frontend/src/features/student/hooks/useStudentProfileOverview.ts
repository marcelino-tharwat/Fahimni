import { useQuery } from '@tanstack/react-query';
import { studentProfileOverviewApi } from '@/features/student/api/studentProfile';

/**
 * Query key for the aggregated student profile overview. Exported so mutations
 * that change identity (profile edit) can invalidate it, and so the logout
 * cache-clear covers it.
 */
export const STUDENT_PROFILE_OVERVIEW_KEY = ['student', 'profile', 'overview'] as const;

/**
 * Single source of truth for the Student Profile page. No try/catch swallow: a
 * failed request surfaces as `isError` so the page can show its error state
 * with a retry, rather than a misleading empty profile.
 */
export function useStudentProfileOverview() {
  return useQuery({
    queryKey: STUDENT_PROFILE_OVERVIEW_KEY,
    queryFn: () => studentProfileOverviewApi.getOverview(),
    staleTime: 60 * 1000,
  });
}
