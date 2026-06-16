import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

export type AuditLogAction =
  | "DELETE_STAGE"
  | "DELETE_CHAPTER"
  | "DELETE_LESSON";

interface AuditLogParams {
  action: AuditLogAction;
  resourceType: string;
  resourceId: string;
  userId: string;
  details?: Record<string, unknown>;
}

export class AuditLogService {
  public async log(params: AuditLogParams): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: (params.details as Prisma.InputJsonValue) ?? Prisma.DbNull,
        userId: params.userId,
      },
    });
  }
}

export const auditLogService = new AuditLogService();
