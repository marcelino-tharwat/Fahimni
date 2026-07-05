import { useQuery } from '@tanstack/react-query';
import { teacherStudentsApi } from '@/features/teacher/api/students';
import type { TeacherStudentsQueryParams } from '@/features/teacher/types/students';

/**
 * Teacher student-engagement list (STORY-74).
 *
 * `params` is part of the query key, so TanStack Query serializes it
 * deterministically and refetches whenever a filter/sort/page changes. The list
 * is always fetched (no `enabled` gate) and uses the QueryClient defaults for
 * `staleTime`/`retry` (see app/config/queryClient.ts).
 */
export function useTeacherStudents(params?: TeacherStudentsQueryParams) {
  return useQuery({
    queryKey: ['teacher', 'students', 'list', params],
    queryFn: () => teacherStudentsApi.getStudentsList(params),
  });
}
