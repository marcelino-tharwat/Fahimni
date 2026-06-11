import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

export function authorizeMiddleware(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role!)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
}
