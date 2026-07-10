import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { AuditLogDTO, Paginated } from "./admin-audit-logs.types.js";
import type { ListAuditLogsQuery } from "./admin-audit-logs.validation.js";

/**
 * Read-path metadata sanitiser (defense in depth on top of the write-time
 * sanitiser). Redacts any key whose (lowercased) name contains a sensitive
 * marker — passwords, tokens (token/tokenVersion/resetToken/accessToken),
 * secrets, provider raw callbacks / checkout urls / HMAC, OTP values, and
 * storage paths/keys/signed urls — recursively through nested objects/arrays.
 */
const SENSITIVE_MARKERS = [
  "password",
  "token",
  "secret",
  "apikey",
  "authorization",
  "otp",
  "rawcallback",
  "callback",
  "checkouturl",
  "hmac",
  "signature",
  "storagepath",
  "storagekey",
  "filepath",
  "signedurl",
  "resettoken",
];
const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_MARKERS.some((m) => k.includes(m));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : sanitizeValue(v);
    }
    return out;
  }
  return value;
}

export function sanitizeAuditMetadata(details: unknown): Record<string, unknown> | null {
  if (details == null || typeof details !== "object" || Array.isArray(details)) return null;
  return sanitizeValue(details) as Record<string, unknown>;
}

const selectFields = {
  id: true,
  action: true,
  resourceType: true,
  resourceId: true,
  details: true,
  actorType: true,
  createdAt: true,
  user: { select: { id: true, fullName: true, email: true } },
} as const;

type Row = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Prisma.JsonValue | null;
  actorType: string | null;
  createdAt: Date;
  user: { id: string; fullName: string; email: string } | null;
};

function toDTO(row: Row): AuditLogDTO {
  return {
    id: row.id,
    action: row.action,
    entityType: row.resourceType,
    entityId: row.resourceId,
    actor: row.user ? { id: row.user.id, fullName: row.user.fullName, email: row.user.email } : null,
    actorType: row.actorType,
    metadata: sanitizeAuditMetadata(row.details),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Admin Audit Logs read model (ADMIN-only). Returns safe fields only; metadata
 * is sanitised on the way out so no secret can leak through a stored detail blob.
 */
export class AdminAuditLogsService {
  async list(query: ListAuditLogsQuery): Promise<Paginated<AuditLogDTO>> {
    const { page, limit, q, actorId, action, entityType, entityId, dateFrom, dateTo } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(actorId ? { userId: actorId } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { resourceType: entityType } : {}),
      ...(entityId ? { resourceId: entityId } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { resourceType: { contains: q, mode: "insensitive" } },
              { actorName: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        select: selectFields,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toDTO),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(auditLogId: string): Promise<AuditLogDTO> {
    const row = await prisma.auditLog.findUnique({ where: { id: auditLogId }, select: selectFields });
    if (!row) throw new AppError("Audit log not found", 404, "AUDIT_LOG_NOT_FOUND");
    return toDTO(row);
  }

  /** Distinct actions + entity types — powers the filter dropdowns. */
  async getFilterOptions(): Promise<{ actions: string[]; entityTypes: string[] }> {
    const [actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      prisma.auditLog.findMany({ distinct: ["resourceType"], select: { resourceType: true }, orderBy: { resourceType: "asc" } }),
    ]);
    return {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.resourceType),
    };
  }
}

export const adminAuditLogsService = new AdminAuditLogsService();
