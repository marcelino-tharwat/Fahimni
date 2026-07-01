import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "./validate.middleware.js";
import { errorHandler } from "./errorHandler.middleware.js";

function express5QueryRequest(raw: Record<string, unknown>): Request {
  const req = {
    method: "GET",
    originalUrl: "/test",
    validated: undefined as Request["validated"],
  } as Request;

  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    get() {
      return raw;
    },
  });

  return req;
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
  } as Response & { statusCode: number; body: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as Response["json"];
  return res;
}

describe("validateRequest (Express 5 query)", () => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    archived: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  });

  it("stores parsed query in req.validated.query without mutating req.query", () => {
    const raw = { limit: "20", archived: "false" };
    const req = express5QueryRequest(raw);
    const next = vi.fn() as NextFunction;

    validateRequest(schema, "query")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validated?.query).toEqual({ limit: 20, archived: false });
    expect(req.query).toBe(raw);
  });

  it("forwards ZodError on invalid query", () => {
    const req = express5QueryRequest({ limit: "invalid" });
    const next = vi.fn() as NextFunction;

    validateRequest(schema, "query")(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(z.ZodError);
    expect(req.validated?.query).toBeUndefined();
  });

  it("returns 400 validation envelope for invalid query via error handler", () => {
    const req = express5QueryRequest({ limit: "invalid" });
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    validateRequest(schema, "query")(req, res, next);
    errorHandler(
      (next as ReturnType<typeof vi.fn>).mock.calls[0]![0],
      req,
      res,
      vi.fn() as NextFunction,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: "Validation error",
    });
  });

  it("still assigns validated body to req.body", () => {
    const bodySchema = z.object({ name: z.string() });
    const req = { body: { name: "  test  " }, validated: undefined } as Request;
    const next = vi.fn() as NextFunction;

    validateRequest(bodySchema)(req, {} as Response, next);

    expect(req.body).toEqual({ name: "  test  " });
    expect(req.validated?.body).toEqual({ name: "  test  " });
    expect(next).toHaveBeenCalledWith();
  });
});
