import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminStatsService } from "./admin-stats.service.js";

export class AdminStatsController {
  public getStats = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const stats = await adminStatsService.getStats();
      res
        .status(200)
        .json(okResponse("Admin stats fetched successfully", stats));
    } catch (error) {
      next(error);
    }
  };
}
