import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/utils/AppError.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

export const authenticateMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        ),
      );
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;

    const userId = decoded.sub ?? decoded.userId;

    if (!userId || typeof userId !== "string") {
      return next(new AppError("Invalid token payload", 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      return next(
        new AppError(
          "The user belonging to this token does no longer exist.",
          401,
        ),
      );
    }

    if (user.status !== "ACTIVE") {
      return next(
        new AppError("Your account is inactive. Please contact support.", 401),
      );
    }

    req.user = { id: user.id, role: user.role };
    res.locals.user = req.user;

    next();
  },
);
