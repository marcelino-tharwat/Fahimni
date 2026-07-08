import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminTeachersApi } from '@/features/admin/api/adminTeachers';
import type { AdminTeachersQuery } from '@/features/admin/types/teachers';

export const ADMIN_TEACHERS_QUERY_KEY = ['admin', 'teachers'] as const;

/** Paginated admin teachers list. Keeps prior page data while refetching. */
export function useAdminTeachers(query: AdminTeachersQuery) {
  return useQuery({
    queryKey: [...ADMIN_TEACHERS_QUERY_KEY, query],
    queryFn: () => adminTeachersApi.list(query),
    placeholderData: keepPreviousData,
  });
}
