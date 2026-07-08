import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminStudentsService } from "./admin-students.service.js";
import type {
  ListStudentsQuery,
  StudentEnrollmentsQuery,
} from "./admin-students.validation.js";

/**
 * Admin Students Management controllers. ADMIN-only (enforced by the /api/admin
 * router convention). Missing / non-STUDENT ids resolve to 404 inside the service.
 */
export class AdminStudentsController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListStudentsQuery;
      const data = await adminStudentsService.listStudents(query);
      res.status(200).json(okResponse("Students fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminStudentsService.getDetail(String(req.params.studentId));
      res.status(200).json(okResponse("Student detail fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getEnrollments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as StudentEnrollmentsQuery;
      const data = await adminStudentsService.getEnrollments(String(req.params.studentId), query);
      res.status(200).json(okResponse("Student enrollments fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminStudentsService.getPayments(String(req.params.studentId));
      res.status(200).json(okResponse("Student payments fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getLearningSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminStudentsService.getLearningSummary(String(req.params.studentId));
      res.status(200).json(okResponse("Student learning summary fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };
}
