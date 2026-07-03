import { Prisma } from "../../generated/prisma/client.js";

export interface SafePrismaClientError {
  statusCode: number;
  message: string;
  reason: string;
  details?: string;
  suggestion?: string;
}

/** Map Prisma client failures to safe, non-technical API responses. */
export function mapPrismaClientError(
  error: Prisma.PrismaClientKnownRequestError,
): SafePrismaClientError {
  switch (error.code) {
    case "P2022":
      return {
        statusCode: 503,
        message: "تعذر إكمال العملية لأن قاعدة البيانات غير متزامنة.",
        reason: "DATABASE_SCHEMA_OUT_OF_DATE",
        details:
          "النظام يحتاج تحديث قاعدة البيانات قبل حفظ الاختبارات المُولَّدة.",
        suggestion: "تواصل مع مسؤول النظام أو أعد تشغيل الخادم بعد تطبيق التحديثات.",
      };
    case "P2025":
      return {
        statusCode: 404,
        message: "السجل المطلوب غير موجود.",
        reason: "RECORD_NOT_FOUND",
      };
    case "P2002":
      return {
        statusCode: 409,
        message: "تعارض في البيانات. قد يكون السجل موجوداً مسبقاً.",
        reason: "UNIQUE_CONSTRAINT",
      };
    case "P2003":
      return {
        statusCode: 400,
        message: "البيانات المرتبطة غير صالحة أو غير موجودة.",
        reason: "FOREIGN_KEY_CONSTRAINT",
      };
    default:
      return {
        statusCode: 500,
        message: "حدث خطأ أثناء الوصول إلى قاعدة البيانات.",
        reason: "DATABASE_ERROR",
        suggestion: "حاول مرة أخرى لاحقاً.",
      };
  }
}

export function isPrismaClientError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
