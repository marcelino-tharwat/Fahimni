import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminUsersApi } from '@/features/admin/api/adminUsers';
import type { AdminUsersQuery } from '@/features/admin/types/users';

const KEY = ['admin', 'users'] as const;

export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminUsersApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserDetail(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', userId],
    queryFn: () => adminUsersApi.getDetail(userId as string),
    enabled: !!userId,
  });
}
