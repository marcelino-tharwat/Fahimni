import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminTeacherWithdrawalsService } from "./admin-teacher-withdrawals.service.js";
import type {
  ListAdminWithdrawalsQuery,
  TeacherSummaryQuery,
  UpdateWithdrawalStatusInput,
} from "./admin-teacher-withdrawals.validation.js";

/**
 * Admin Teacher Withdrawal Requests controllers. ADMIN-only (enforced by the
 * /api/admin router convention).
 */
export class AdminTeacherWithdrawalsController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListAdminWithdrawalsQuery;
      const data = await adminTeacherWithdrawalsService.list(query);
      res.status(200).json(okResponse("Withdrawal requests fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId } = req.params as { withdrawalId: string };
      const data = await adminTeacherWithdrawalsService.getDetail(withdrawalId);
      res.status(200).json(okResponse("Withdrawal request fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId } = req.params as { withdrawalId: string };
      const input = (req.validated?.body ?? req.body) as UpdateWithdrawalStatusInput;
      const data = await adminTeacherWithdrawalsService.updateStatus(
        withdrawalId,
        req.user!.id,
        input,
      );
      res.status(200).json(okResponse("Withdrawal request status updated successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public teacherSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as TeacherSummaryQuery;
      const data = await adminTeacherWithdrawalsService.getTeacherSummary(query);
      res.status(200).json(okResponse("Teacher financial summaries fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };
}
