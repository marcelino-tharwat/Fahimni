import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { dashboardService } from "./dashboard.service.js";
import { studentEngagementService } from "./student-engagement.service.js";
import { studentDetailService } from "./student-detail.service.js";
import {
  studentEngagementQuerySchema,
  teacherStudentDetailQuerySchema,
} from "./student-engagement.validation.js";
import type {
  StudentEngagementPageDTO,
  TeacherDashboardStatsDTO,
  TeacherStudentDetailResponse,
} from "./dashboard.types.js";

export class DashboardController {
  /**
   * GET /api/dashboard/teacher/stats
   *
   * Teacher identity is taken exclusively from the authenticated request
   * (`req.user.id`); a client-supplied id can never override it.
   */
  public getTeacherStats = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const stats = await dashboardService.getTeacherStats(req.user!.id);

      res
        .status(200)
        .json(
          okResponse<TeacherDashboardStatsDTO>(
            "Teacher dashboard stats fetched successfully",
            stats,
          ),
        );
    },
  );

  /**
   * GET /api/dashboard/teacher/students (STORY-66)
   *
   * Teacher identity is taken exclusively from `req.user.id`. Query params are
   * validated here (Express 5 `req.query` is a read-only getter, so the shared
   * query-validation middleware cannot reassign it).
   */
  public getTeacherStudents = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const parsed = studentEngagementQuerySchema.safeParse(req.query);
      if (!parsed.success) throw parsed.error;

      const data = await studentEngagementService.getTeacherStudents(
        req.user!.id,
        parsed.data,
      );

      res
        .status(200)
        .json(
          okResponse<StudentEngagementPageDTO>(
            "Teacher students fetched successfully",
            data,
          ),
        );
    },
  );

  /**
   * GET /api/dashboard/teacher/students/:studentId (STORY-75)
   *
   * Teacher identity is taken exclusively from `req.user.id`; `studentId` is a
   * validated path param. Query params are validated here via safeParse (Express
   * 5 `req.query` is a read-only getter). Ownership is enforced in the service:
   * a student outside the teacher's stages yields a 404, not a 403.
   */
  public getTeacherStudentDetail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const parsed = teacherStudentDetailQuerySchema.safeParse(req.query);
      if (!parsed.success) throw parsed.error;

      const data = await studentDetailService.getStudentDetail(
        req.user!.id,
        req.params.studentId as string,
        parsed.data,
      );

      res
        .status(200)
        .json(
          okResponse<TeacherStudentDetailResponse>(
            "Teacher student detail fetched successfully",
            data,
          ),
        );
    },
  );
}
