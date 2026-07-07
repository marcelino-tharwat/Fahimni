import type { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import type { CreateUserInput, ListUsersQuery } from "./user.validation.js";

const userService = new UserService();

export class UserController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query is validated + coerced by validateRequest(listUsersQuerySchema).
      const query = (req.validated?.query ?? req.query) as ListUsersQuery;
      const result = await userService.listUsers(query);
      res.status(200).json(okResponse("Users fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Route is ADMIN-only; the acting admin is taken from the DB-sourced
      // req.user (never from the request body).
      const actorId = req.user!.id;
      const user = await userService.createUser(
        req.body as CreateUserInput,
        actorId,
      );
      res.status(201).json(okResponse("User created successfully", user));
    } catch (error) {
      next(error);
    }
  };
}
