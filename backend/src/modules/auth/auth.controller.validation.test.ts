import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AuthController } from "./auth.controller.js";
import { errorHandler } from "../../shared/middlewares/errorHandler.middleware.js";

// Regression test for a bug found during the final i18n/whitespace sweep:
// every auth handler used to hand-roll `res.status(400).json({ message:
// "Validation error", errors: parsed.error.flatten().fieldErrors })` on a
// failed Zod parse. That bypassed `adaptZodError`/`classifyZodIssue`
// entirely (no stable `code`, and `errors` was a `Record<string,string[]>`
// instead of the `{field,code,message}[]` shape the frontend's
// `translateFieldErrors` expects — which made it throw on a real 400).
// The fix: throw the ZodError so it flows through the same global
// `errorHandler` pipeline every other module already uses.

function mockReqRes(body: unknown, acceptLanguage?: string) {
  const req = {
    body,
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  } as unknown as Request;
  const res = {
    statusCode: 0,
    body: undefined as unknown,
  } as Response & { statusCode: number; body: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response["status"];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as Response["json"];
  return { req, res };
}

const controller = new AuthController();

describe("AuthController — Zod validation failures flow through the global error handler", () => {
  it("login: an invalid body calls next() with a ZodError (never a hand-rolled 400 response)", async () => {
    const { req, res } = mockReqRes({ email: "not-an-email", password: "" });
    const next = vi.fn() as NextFunction;

    await controller.login(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(ZodError);
  });

  it("register: an invalid body calls next() with a ZodError", async () => {
    const { req, res } = mockReqRes({ email: "bad", password: "short" });
    const next = vi.fn() as NextFunction;

    await controller.register(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBeInstanceOf(ZodError);
  });

  it("end-to-end through errorHandler: the resulting response has the stable {code, errors:[]} shape, localized", async () => {
    const { req, res } = mockReqRes({ email: "not-an-email", password: "" });
    const next = vi.fn((err: unknown) => {
      errorHandler(err as Error, { ...req, headers: { "accept-language": "ar" } } as Request, res, vi.fn());
    }) as unknown as NextFunction;

    await controller.login(req, res, next);

    expect(res.statusCode).toBe(400);
    const body = res.body as {
      code: string;
      errors: Array<{ field: string; code: string; message: string }>;
    };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.errors)).toBe(true);
    const emailError = body.errors.find((e) => e.field === "email");
    expect(emailError).toMatchObject({ code: "EMAIL_INVALID" });
    // Localized (Arabic) — not the raw hardcoded English Zod message.
    expect(emailError!.message).toBe("البريد الإلكتروني غير صالح");
  });
});
