import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function resolveRequestId(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw && REQUEST_ID_PATTERN.test(raw)) {
    return raw;
  }
  return randomUUID();
}

/** Attach a safe request id and echo it in `X-Request-Id`. */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.header("x-request-id"));
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
