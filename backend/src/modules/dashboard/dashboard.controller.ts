import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { dashboardService } from "./dashboard.service.js";
import type { TeacherDashboardStatsDTO } from "./dashboard.types.js";

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
}
