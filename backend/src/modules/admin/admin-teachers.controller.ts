import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminTeachersService } from "./admin-teachers.service.js";
import type { ListTeachersQuery } from "./admin-teachers.validation.js";

export class AdminTeachersController {
  /** GET /api/admin/teachers — paginated, safe teacher management list. */
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query is validated + coerced by validateRequest(listTeachersQuerySchema).
      const query = (req.validated?.query ?? req.query) as ListTeachersQuery;
      const result = await adminTeachersService.listTeachers(query);
      res
        .status(200)
        .json(okResponse("Teachers fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };
}
