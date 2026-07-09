import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminUsersService } from "./admin-users.service.js";
import type { ListUsersQuery } from "./admin-users.validation.js";

export class AdminUsersController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListUsersQuery;
      const data = await adminUsersService.listUsers(query);
      res.status(200).json(okResponse("Users fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await adminUsersService.getDetail(
        String(req.params.userId),
      );
      res
        .status(200)
        .json(okResponse("User detail fetched successfully", data));
    } catch (error) {
      next(error);
    }
  };
}
