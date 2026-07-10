import { useQuery } from '@tanstack/react-query';
import { adminAuditLogsApi } from '@/features/admin/api/adminAuditLogs';
import type { AuditLogsQuery } from '@/features/admin/types/auditLogs';

const KEY = ['admin', 'audit-logs'] as const;

export function useAuditLogs(query: AuditLogsQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminAuditLogsApi.list(query),
    staleTime: 15_000,
  });
}

export function useAuditFilterOptions() {
  return useQuery({
    queryKey: [...KEY, 'filters'],
    queryFn: adminAuditLogsApi.getFilterOptions,
    staleTime: 60_000,
  });
}
