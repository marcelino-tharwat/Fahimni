import { useQuery } from '@tanstack/react-query';
import { teacherStudentDetailApi } from '@/features/teacher/api/studentDetail';
import type { TeacherStudentDetailQueryParams } from '@/features/teacher/types/studentDetail';

/**
 * Teacher single-student engagement detail (STORY-75).
 *
 * `studentId` comes from the route params and may be undefined on the first
 * render, so the query is gated with `enabled`. `studentId` + `params` are part
 * of the query key, so TanStack Query refetches on any change. The raw query is
 * returned as-is — 404-vs-other-error handling is the page's responsibility.
 */
export function useStudentDetail(
  studentId: string | undefined,
  params?: TeacherStudentDetailQueryParams,
) {
  return useQuery({
    queryKey: ['teacher', 'students', 'detail', studentId, params],
    queryFn: () => teacherStudentDetailApi.getStudentDetail(studentId!, params),
    enabled: Boolean(studentId),
  });
}
