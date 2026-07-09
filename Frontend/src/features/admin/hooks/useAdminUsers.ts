import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminUsersApi } from '@/features/admin/api/adminUsers';
import type { AdminUsersQuery, AdminCreateUserPayload, AdminUpdateUserPayload, AdminChangeStatusPayload, AdminChangeRolePayload } from '@/features/admin/types/users';

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

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminCreateUserPayload) => adminUsersApi.createUser(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminUpdateUserPayload }) =>
      adminUsersApi.updateUser(userId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useChangeUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminChangeStatusPayload }) =>
      adminUsersApi.changeStatus(userId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminChangeRolePayload }) =>
      adminUsersApi.changeRole(userId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}
