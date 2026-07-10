import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AuditFilterOptions,
  AuditLog,
  AuditLogsQuery,
  Paginated,
} from '@/features/admin/types/auditLogs';

function toParams(q: AuditLogsQuery): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (q.page != null) p.page = q.page;
  if (q.limit != null) p.limit = q.limit;
  if (q.q) p.q = q.q;
  if (q.actorId) p.actorId = q.actorId;
  if (q.action) p.action = q.action;
  if (q.entityType) p.entityType = q.entityType;
  if (q.entityId) p.entityId = q.entityId;
  if (q.dateFrom) p.dateFrom = q.dateFrom;
  if (q.dateTo) p.dateTo = q.dateTo;
  return p;
}

export const adminAuditLogsApi = {
  list: async (query: AuditLogsQuery): Promise<Paginated<AuditLog>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<AuditLog>>>('/admin/audit-logs', {
      params: toParams(query),
    });
    return data.data;
  },
  get: async (auditLogId: string): Promise<AuditLog> => {
    const { data } = await apiClient.get<ApiResponse<AuditLog>>(`/admin/audit-logs/${auditLogId}`);
    return data.data;
  },
  getFilterOptions: async (): Promise<AuditFilterOptions> => {
    const { data } = await apiClient.get<ApiResponse<AuditFilterOptions>>('/admin/audit-logs/filters');
    return data.data;
  },
};
