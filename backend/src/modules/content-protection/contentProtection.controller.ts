import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { logger } from "../../config/logger.js";
import type { AuditLogAction } from "../../shared/services/auditLog.service.js";

const VALID_ACTIONS: ReadonlySet<string> = new Set([
  "copy_blocked",
  "paste_blocked",
  "print_blocked",
  "protected_content_blurred",
  "contextmenu_blocked",
]);

const ACTION_TO_AUDIT: Record<string, AuditLogAction> = {
  copy_blocked: "CONTENT_PROTECTION_COPY_BLOCKED",
  paste_blocked: "CONTENT_PROTECTION_PASTE_BLOCKED",
  print_blocked: "CONTENT_PROTECTION_PRINT_BLOCKED",
  protected_content_blurred: "CONTENT_PROTECTION_CONTENT_BLURRED",
  contextmenu_blocked: "CONTENT_PROTECTION_CONTEXTMENU_BLOCKED",
};

interface ContentProtectionEventBody {
  action: string;
  resourceType?: string;
  resourceId?: string;
  route?: string;
}

export class ContentProtectionController {
  /**
   * Log a content-protection deterrence event (copy/paste/print blocked, tab
   * blur, context-menu blocked).  Fails silently so a logging error never
   * breaks the user's page.  Returns 204 on success.
   */
  reportEvent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const body = req.body as ContentProtectionEventBody;

      if (!body.action || !VALID_ACTIONS.has(body.action)) {
        res.status(400).json({
          success: false,
          message: "Invalid or missing action",
        });
        return;
      }

      try {
        const auditAction = ACTION_TO_AUDIT[body.action]!;
        const userId = req.user!.id;

        await auditLogService.record({
          action: auditAction,
          resourceType: body.resourceType ?? "content_protection",
          resourceId: body.resourceId ?? "unknown",
          actorId: userId,
          actorType: "STUDENT",
          scopeTeacherId: userId,
          details: body.route !== undefined ? { route: body.route } : null,
        });

        res.status(204).send();
      } catch (err) {
        logger.warn(
          "Content-protection event logging failed (non-critical)",
          err,
        );
        res.status(204).send();
      }
    },
  );
}
