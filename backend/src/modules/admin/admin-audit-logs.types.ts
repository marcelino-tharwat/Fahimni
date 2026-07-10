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

export interface AuditActorRef {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditLogDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: AuditActorRef | null;
  actorType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
