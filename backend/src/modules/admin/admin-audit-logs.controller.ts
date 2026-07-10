import type { Request, Response } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminAuditLogsService } from "./admin-audit-logs.service.js";
import type { ListAuditLogsQuery } from "./admin-audit-logs.validation.js";

export class AdminAuditLogsController {
  list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validated?.query ?? req.query) as ListAuditLogsQuery;
    const result = await adminAuditLogsService.list(query);
    res.status(200).json(okResponse("Audit logs fetched successfully", result));
  };

  getFilterOptions = async (_req: Request, res: Response): Promise<void> => {
    const result = await adminAuditLogsService.getFilterOptions();
    res.status(200).json(okResponse("Audit log filter options fetched", result));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await adminAuditLogsService.getById(req.params.auditLogId as string);
    res.status(200).json(okResponse("Audit log fetched successfully", result));
  };
}
