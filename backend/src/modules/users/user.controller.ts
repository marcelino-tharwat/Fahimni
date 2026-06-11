import type { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import type { CreateUserInput } from "./user.validation.js";

const userService = new UserService();

export class UserController {
  public list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await userService.listUsers();
      res.status(200).json(okResponse("Users fetched successfully", users));
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.createUser(req.body as CreateUserInput);
      res.status(201).json(okResponse("User created successfully", user));
    } catch (error) {
      next(error);
    }
  };
}
