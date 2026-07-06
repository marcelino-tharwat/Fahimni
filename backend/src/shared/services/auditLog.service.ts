import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";

/**
 * Centralised activity / audit vocabulary.
 *
 * Activities are state-changing events worth surfacing on a teacher dashboard.
 * The frontend renders localized text from `action` + `resourceType` +
 * `actorName` + sanitized `details`, so we store structured data rather than
 * pre-baked sentences.
 */
export type AuditLogAction =
  | "STAGE_CREATED"
  | "STAGE_UPDATED"
  | "STAGE_DELETED"
  | "CHAPTER_CREATED"
  | "CHAPTER_UPDATED"
  | "CHAPTER_DELETED"
  | "LESSON_CREATED"
  | "LESSON_UPDATED"
  | "LESSON_DELETED"
  | "QUIZ_CREATED"
  | "QUIZ_GENERATED"
  | "QUIZ_UPDATED"
  | "QUIZ_DELETED"
  | "QUIZ_PUBLISHED"
  | "QUIZ_UNPUBLISHED"
  | "QUIZ_ASSIGNED"
  | "QUIZ_COMPLETED"
  | "STUDENT_ENROLLED"
  | "STUDENT_UNENROLLED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  // Legacy values retained so historical rows remain readable.
  | "DELETE_STAGE"
  | "DELETE_CHAPTER"
  | "DELETE_LESSON"
  // Content-protection events (client-side deterrence).
  | "CONTENT_PROTECTION_COPY_BLOCKED"
  | "CONTENT_PROTECTION_PASTE_BLOCKED"
  | "CONTENT_PROTECTION_PRINT_BLOCKED"
  | "CONTENT_PROTECTION_CONTENT_BLURRED"
  | "CONTENT_PROTECTION_CONTEXTMENU_BLOCKED";

export type ActorType = "TEACHER" | "STUDENT" | "ADMIN" | "SYSTEM";

export interface ActivityParams {
  action: AuditLogAction;
  resourceType: string;
  resourceId: string;
  /** The user who performed the action (teacher or student). */
  actorId: string;
  actorType?: ActorType;
  /** Denormalized display name; only needed for non-teacher actors. */
  actorName?: string | null;
  /** Teacher whose dashboard/activity stream should surface this event. */
  scopeTeacherId: string;
  /** Sanitized, non-sensitive metadata only. */
  details?: Record<string, unknown> | null;
}

/**
 * Fields that must never be persisted in activity metadata. Anything matching
 * (case-insensitively) is stripped before the record is written, so a careless
 * caller cannot leak secrets through the dashboard endpoint.
 */
const SENSITIVE_KEYS = [
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "apikey",
  "otp",
  "code",
];

function sanitizeMetadata(
  details?: Record<string, unknown> | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!details) return Prisma.DbNull;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) continue;
    // Drop functions / undefined and avoid storing large blobs.
    if (typeof value === "function" || value === undefined) continue;
    if (typeof value === "string" && value.length > 500) {
      safe[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    safe[key] = value;
  }

  return Object.keys(safe).length > 0
    ? (safe as Prisma.InputJsonValue)
    : Prisma.DbNull;
}

/** A Prisma transaction client or the root client — both expose `auditLog`. */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

export class AuditLogService {
  /**
   * Record an activity event. Designed to be safe to call from anywhere:
   * failures are swallowed and logged so a non-critical activity write can
   * never break the surrounding mutation. Pass a transaction client (`tx`) to
   * make the write transactional with the mutation that produced it.
   */
  public async record(
    params: ActivityParams,
    tx: PrismaLike = prisma,
  ): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          userId: params.actorId,
          actorType: params.actorType ?? "TEACHER",
          actorName: params.actorName ?? null,
          scopeTeacherId: params.scopeTeacherId,
          details: sanitizeMetadata(params.details),
        },
      });
    } catch (err) {
      // Never let activity logging break the business operation.
      logger.warn(
        `Failed to record activity (${params.action} ${params.resourceType}:${params.resourceId})`,
        err,
      );
    }
  }
}

export const auditLogService = new AuditLogService();
