import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminTeacherDetailService } from "./admin-teacher-detail.service.js";
import type {
  TeacherEnrollmentsQuery,
  TeacherStudentsQuery,
} from "./admin-teacher-detail.validation.js";

/**
 * Admin Teacher Detail controllers. ADMIN-only (enforced by the /api/admin
 * router convention). A non-existent teacher — or a user whose role is not
 * OPERATION — resolves to 404 inside the service.
 */
export class AdminTeacherDetailController {
  public getDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherDetailService.getDetail(String(req.params.teacherId));
      res.status(200).json(okResponse("Teacher detail fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as TeacherStudentsQuery;
      const data = await adminTeacherDetailService.getStudents(String(req.params.teacherId), query);
      res.status(200).json(okResponse("Teacher students fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getEnrollments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as TeacherEnrollmentsQuery;
      const data = await adminTeacherDetailService.getEnrollments(String(req.params.teacherId), query);
      res.status(200).json(okResponse("Teacher enrollments fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherDetailService.getContent(String(req.params.teacherId));
      res.status(200).json(okResponse("Teacher content fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getRevenue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherDetailService.getRevenue(String(req.params.teacherId));
      res.status(200).json(okResponse("Teacher revenue fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherDetailService.getSubscription(String(req.params.teacherId));
      res.status(200).json(okResponse("Teacher subscription fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getAiUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminTeacherDetailService.getAiUsage(String(req.params.teacherId));
      res.status(200).json(okResponse("Teacher AI usage fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };
}
