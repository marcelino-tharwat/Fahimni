import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../utils/AppError.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  let status = 500;
  if (err instanceof AppError) {
    status = err.statusCode;
  } else if ("status" in err && typeof (err as Record<string, unknown>).status === "number") {
    status = err.status as number;
  }

  const message =
    err instanceof Error ? err.message : "Internal server error";

  if (status >= 500) {
    logger.error(message, err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(env.NODE_ENV === "development" &&
    status >= 500 &&
    err instanceof Error &&
    err.stack
      ? { stack: err.stack }
      : {}),
  });
};
