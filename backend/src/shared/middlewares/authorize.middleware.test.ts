import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authorizeMiddleware } from "./authorize.middleware.js";
import { AppError } from "../utils/AppError.js";

function run(user: { role?: string } | undefined, ...roles: string[]) {
  const req = { user } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  authorizeMiddleware(...roles)(req, {} as Response, next);
  return next as unknown as ReturnType<typeof vi.fn>;
}

describe("authorizeMiddleware (dashboard access control)", () => {
  it("rejects an unauthenticated request with 403", () => {
    const next = run(undefined, "OPERATION");
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it("rejects a non-teacher role (e.g. STUDENT)", () => {
    const next = run({ role: "STUDENT" }, "OPERATION");
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it("allows the teacher role (OPERATION)", () => {
    const next = run({ role: "OPERATION" }, "OPERATION");
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});
