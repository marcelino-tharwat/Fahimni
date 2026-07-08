import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminTeacherRequestsService } from "./admin-teacher-requests.service.js";
import type {
  ApproveRequestInput,
  ListTeacherRequestsQuery,
  RejectRequestInput,
} from "./admin-teacher-requests.validation.js";

/**
 * Admin Teacher Registration Requests controllers. ADMIN-only (enforced by the
 * /api/admin router convention). Missing/malformed requestId → 404 in the service.
 */
export class AdminTeacherRequestsController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListTeacherRequestsQuery;
      const data = await adminTeacherRequestsService.listRequests(query);
      res.status(200).json(okResponse("Teacher requests fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherRequestsService.getDetail(String(req.params.requestId));
      res.status(200).json(okResponse("Teacher request detail fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getDocumentSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const index = Number(req.params.documentIndex);
      const data = await adminTeacherRequestsService.getDocumentSignedUrl(
        String(req.params.requestId),
        index,
      );
      res.status(200).json(okResponse("Signed URL generated", data));
    } catch (error) {
      next(error);
    }
  };

  public approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.validated?.body ?? req.body) as ApproveRequestInput;
      const data = await adminTeacherRequestsService.approve(
        String(req.params.requestId),
        req.user!.id,
        body,
      );
      res.status(200).json(okResponse("Teacher request approved", data));
    } catch (error) {
      next(error);
    }
  };

  public reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.validated?.body ?? req.body) as RejectRequestInput;
      const data = await adminTeacherRequestsService.reject(
        String(req.params.requestId),
        req.user!.id,
        body,
      );
      res.status(200).json(okResponse("Teacher request rejected", data));
    } catch (error) {
      next(error);
    }
  };
}
