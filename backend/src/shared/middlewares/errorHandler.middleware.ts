import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../utils/AppError.js";
import { QuizGenerationError } from "../../modules/quizzes/quiz-generation.errors.js";
import {
  isPrismaClientError,
  mapPrismaClientError,
} from "../utils/prismaErrors.js";
import { getRequestLocale } from "../utils/locale.js";
import { adaptZodError } from "../utils/validationCodes.js";

const INTERNAL_ERROR_MESSAGE = {
  en: "An internal error occurred. Please try again later.",
  ar: "حدث خطأ داخلي. يرجى المحاولة لاحقاً.",
};

const MULTER_ERROR_CODE: Record<string, string> = {
  LIMIT_FILE_SIZE: "FILE_TOO_LARGE",
  LIMIT_FILE_COUNT: "MAX_FILES_EXCEEDED",
  LIMIT_UNEXPECTED_FILE: "MAX_FILES_EXCEEDED",
};

const MULTER_ERROR_MESSAGE: Record<string, Record<"en" | "ar", string>> = {
  FILE_TOO_LARGE: { en: "The file is too large", ar: "حجم الملف كبير جدًا" },
  MAX_FILES_EXCEEDED: {
    en: "Too many files uploaded",
    ar: "تم تجاوز الحد الأقصى لعدد الملفات",
  },
};

function requestPath(req: { originalUrl?: string; url?: string }): string {
  const url = req.originalUrl ?? req.url ?? "";
  return url.split("?")[0] ?? "";
}

function isUnsafeInternalMessage(message: string): boolean {
  return (
    message.includes("Invalid `") ||
    message.includes("invocation in") ||
    message.includes("PrismaClient") ||
    message.includes("P20")
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    logger.warn("validation_error", {
      requestId: req.requestId,
      method: req.method,
      path: requestPath(req),
      statusCode: 400,
    });
    const locale = getRequestLocale(req);
    const { code, message, errors } = adaptZodError(err, locale);
    res.status(400).json({
      success: false,
      statusCode: 400,
      code,
      message,
      errors,
    });
    return;
  }

  if (err instanceof MulterError) {
    const locale = getRequestLocale(req);
    const code = MULTER_ERROR_CODE[err.code] ?? "FILE_UPLOAD_ERROR";
    const message = MULTER_ERROR_MESSAGE[code]?.[locale] ?? err.message;
    logger.warn("file_upload_error", {
      requestId: req.requestId,
      method: req.method,
      path: requestPath(req),
      statusCode: 400,
      multerCode: err.code,
    });
    res.status(400).json({
      success: false,
      statusCode: 400,
      code,
      message,
    });
    return;
  }

  if (isPrismaClientError(err)) {
    const safe = mapPrismaClientError(err);
    logger.error("prisma_client_error", {
      requestId: req.requestId,
      method: req.method,
      path: requestPath(req),
      statusCode: safe.statusCode,
      prismaCode: err.code,
      errorName: err.name,
    });
    res.status(safe.statusCode).json({
      success: false,
      statusCode: safe.statusCode,
      message: safe.message,
      reason: safe.reason,
      ...(safe.details ? { details: safe.details } : {}),
      ...(safe.suggestion ? { suggestion: safe.suggestion } : {}),
    });
    return;
  }

  let status = 500;
  if (err instanceof AppError) {
    status = err.statusCode;
  } else if ("status" in err && typeof (err as Record<string, unknown>).status === "number") {
    status = err.status as number;
  }

  let message =
    err instanceof Error ? err.message : "Internal server error";

  if (status >= 500 && isUnsafeInternalMessage(message)) {
    message = INTERNAL_ERROR_MESSAGE[getRequestLocale(req)];
  }

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
    logger.error("http_error", {
      ...logMeta,
      message: err instanceof Error ? err.message : message,
    });
  } else {
    logger.warn("http_error", { ...logMeta, message });
  }

  const safeExtras: Record<string, string> = {};
  if (err && typeof err === "object") {
    for (const key of ["reason", "details", "suggestion", "code"] as const) {
      const value = (err as Record<string, unknown>)[key];
      if (typeof value === "string") {
        safeExtras[key] = value;
      }
    }
  }

  if (err instanceof QuizGenerationError) {
    safeExtras.reason = err.reason;
    if (err.details) safeExtras.details = err.details;
    safeExtras.suggestion = err.suggestion;
    message = err.message;
  }

  res.status(status).json({
    success: false,
    statusCode: status,
    message,
    ...safeExtras,
    ...(err instanceof AppError && err.meta ? err.meta : {}),
  });
};
