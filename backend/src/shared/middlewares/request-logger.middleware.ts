import type { Request, Response, NextFunction } from "express";
import { logger } from "../../config/logger.js";

/** Structured request completion log — no bodies, cookies, or auth headers. */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info("http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ...(req.user?.id ? { userId: req.user.id } : {}),
      ...(req.user?.role ? { role: req.user.role } : {}),
    });
  });

  next();
}
