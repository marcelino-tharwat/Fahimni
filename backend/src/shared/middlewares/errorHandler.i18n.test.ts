import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MulterError } from "multer";
import { errorHandler } from "./errorHandler.middleware.js";
import { AppError } from "../utils/AppError.js";

function mockReq(acceptLanguage?: string): Request {
  return {
    method: "POST",
    originalUrl: "/test",
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  } as unknown as Request;
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

const next = vi.fn() as NextFunction;

describe("errorHandler — locale-aware validation responses", () => {
  const schema = z.object({ email: z.string().email() });

  it("defaults to English when no Accept-Language header is present", () => {
    const result = schema.safeParse({ email: "bad" });
    if (result.success) throw new Error("expected failure");
    const req = mockReq();
    const res = mockRes();

    errorHandler(result.error, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Validation error",
    });
    const body = res.body as { errors: Array<{ field: string; code: string; message: string }> };
    expect(body.errors).toEqual([
      expect.objectContaining({ field: "email", code: "EMAIL_INVALID", message: "Invalid email address" }),
    ]);
  });

  it("returns Arabic messages end-to-end when Accept-Language is Arabic", () => {
    const result = schema.safeParse({ email: "bad" });
    if (result.success) throw new Error("expected failure");
    const req = mockReq("ar-EG,ar;q=0.9");
    const res = mockRes();

    errorHandler(result.error, req, res, next);

    const body = res.body as { message: string; errors: Array<{ message: string }> };
    expect(body.message).toBe("بيانات غير صالحة");
    expect(body.errors[0]!.message).toBe("البريد الإلكتروني غير صالح");
  });

  it("never mixes an Arabic top-level message with English field messages, or vice versa", () => {
    const result = schema.safeParse({ email: "bad" });
    if (result.success) throw new Error("expected failure");

    for (const [header, expectArabic] of [["ar", true], ["en", false], [undefined, false]] as const) {
      const req = mockReq(header);
      const res = mockRes();
      errorHandler(result.error, req, res, next);
      const body = res.body as { message: string; errors: Array<{ message: string }> };
      const topIsArabic = /[؀-ۿ]/.test(body.message);
      const fieldIsArabic = /[؀-ۿ]/.test(body.errors[0]!.message);
      expect(topIsArabic).toBe(expectArabic);
      expect(fieldIsArabic).toBe(expectArabic);
    }
  });
});

describe("errorHandler — file upload (Multer) errors get stable codes + 400 status", () => {
  it("maps LIMIT_FILE_SIZE to FILE_TOO_LARGE with a 400 status", () => {
    const err = new MulterError("LIMIT_FILE_SIZE");
    const req = mockReq("en");
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "FILE_TOO_LARGE" });
  });

  it("maps LIMIT_UNEXPECTED_FILE to MAX_FILES_EXCEEDED with a 400 status", () => {
    const err = new MulterError("LIMIT_UNEXPECTED_FILE");
    const req = mockReq("ar");
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "MAX_FILES_EXCEEDED" });
    expect((res.body as { message: string }).message).toBe("تم تجاوز الحد الأقصى لعدد الملفات");
  });
});

describe("errorHandler — AppError business errors preserve stable codes", () => {
  it("surfaces a business AppError's code + statusCode unchanged", () => {
    const err = new AppError("Duplicate email", 409, "DUPLICATE_EMAIL");
    const req = mockReq("en");
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, statusCode: 409, code: "DUPLICATE_EMAIL" });
  });

  it("masks unsafe internal 500 messages with a locale-aware generic message", () => {
    const err = new Error("Invalid `prisma.user.findUnique()` invocation in /app/foo.ts");
    const req = mockReq("ar");
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect((res.body as { message: string }).message).toBe("حدث خطأ داخلي. يرجى المحاولة لاحقاً.");
  });
});
