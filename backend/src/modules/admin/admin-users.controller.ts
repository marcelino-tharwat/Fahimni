import type { Request, Response, NextFunction } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminUsersService } from "./admin-users.service.js";
import type {
  ListUsersQuery,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminChangeStatusInput,
  AdminChangeRoleInput,
} from "./admin-users.validation.js";

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

  public createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = req.user!.id;
      const data = await adminUsersService.createUser(
        req.body as AdminCreateUserInput,
        actorId,
      );
      res.status(201).json(okResponse("User created successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = req.user!.id;
      const data = await adminUsersService.updateUser(
        String(req.params.userId),
        req.body as AdminUpdateUserInput,
        actorId,
      );
      res.status(200).json(okResponse("User updated successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public changeStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = req.user!.id;
      const data = await adminUsersService.changeStatus(
        String(req.params.userId),
        req.body as AdminChangeStatusInput,
        actorId,
      );
      res.status(200).json(okResponse("User status changed successfully", data));
    } catch (error) {
      next(error);
    }
  };

  public changeRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = req.user!.id;
      const data = await adminUsersService.changeRole(
        String(req.params.userId),
        req.body as AdminChangeRoleInput,
        actorId,
      );
      res.status(200).json(okResponse("User role changed successfully", data));
    } catch (error) {
      next(error);
    }
  };
}
