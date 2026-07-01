import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../utils/AppError.js";

function requestPath(req: { originalUrl?: string; url?: string }): string {
  const url = req.originalUrl ?? req.url ?? "";
  return url.split("?")[0] ?? "";
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    logger.warn("validation_error", {
      requestId: req.requestId,
      method: req.method,
      path: requestPath(req),
      statusCode: 400,
    });
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

  const logMeta = {
    requestId: req.requestId,
    method: req.method,
    path: requestPath(req),
    statusCode: status,
    errorName: err instanceof Error ? err.name : "UnknownError",
    ...(err instanceof AppError && err.code ? { code: err.code } : {}),
    ...(env.NODE_ENV !== "production" &&
    err instanceof Error &&
    err.stack
      ? { stack: err.stack }
      : {}),
  };

  if (status >= 500) {
    logger.error("http_error", { ...logMeta, message });
  } else {
    logger.warn("http_error", { ...logMeta, message });
  }

  // Surface safe, structured fields only when the error explicitly carries them
  // as strings — e.g. quiz-generation 422 errors or machine-readable error codes.
  const safeExtras: Record<string, string> = {};
  if (err && typeof err === "object") {
    for (const key of ["reason", "details", "suggestion", "code"] as const) {
      const value = (err as Record<string, unknown>)[key];
      if (typeof value === "string") {
        safeExtras[key] = value;
      }
    }
  }

  res.status(status).json({
    success: false,
    statusCode: status,
    message,
    ...safeExtras,
    ...(err instanceof AppError && err.meta ? err.meta : {}),
    ...(env.NODE_ENV === "development" &&
    status >= 500 &&
    err instanceof Error &&
    err.stack
      ? { stack: err.stack }
      : {}),
  });
};
