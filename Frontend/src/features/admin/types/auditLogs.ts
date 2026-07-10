export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AuditActor {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: AuditActor | null;
  actorType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogsQuery {
  q?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AuditFilterOptions {
  actions: string[];
  entityTypes: string[];
}
