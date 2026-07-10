import { randomBytes } from "node:crypto";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import {
  promoCodePublicFields,
  promoCodeListFields,
} from "./promo-code.types.js";
import type {
  PromoCodeResponseDTO,
  PromoCodeListItemDTO,
  PromoCodeValidationResult,
  PaginatedPromoCodes,
} from "./promo-code.types.js";
import { enrollmentPublicFields } from "../enrollment/enrollment.types.js";
import type { EnrollmentResponseDTO } from "../enrollment/enrollment.types.js";
import type { ListPromoCodesQuery } from "./promo-code.validation.js";
import { REDEEM_MESSAGES, type Locale } from "./promo-code.i18n.js";
import { isTeacherVisibleForDiscovery } from "../teacher-access/teacher-access.service.js";

export interface RedeemResult {
  enrollment: EnrollmentResponseDTO;
  promoCode: { code: string; isUsed: boolean; usedAt: Date };
}

export const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 10;

export class PromoCodeService {
  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = this.randomCode();
      const existing = await prisma.promoCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    throw new AppError(
      "Could not generate a unique promo code, please try again",
      500,
    );
  }

  private randomCode(): string {
    const limit = 256 - (256 % CODE_CHARSET.length);
    let code = "";

    while (code.length < CODE_LENGTH) {
      const bytes = randomBytes(CODE_LENGTH);
      for (const byte of bytes) {
        if (byte >= limit) {
          continue;
        }
        code += CODE_CHARSET[byte % CODE_CHARSET.length];
        if (code.length === CODE_LENGTH) {
          break;
        }
      }
    }

    return code;
  }

  /**
   * Create a promo code for a chapter. When `ownerTeacherId` is provided (an
   * OPERATION caller) the chapter MUST belong to that teacher — a teacher can
   * only mint codes for their own chapters, never for another teacher's content.
   * When it is omitted (an ADMIN caller) any existing chapter is allowed.
   */
  public async create(
    createdById: string,
    chapterId: string,
    ownerTeacherId?: string,
  ): Promise<PromoCodeResponseDTO> {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        // Scope to the teacher's own content when the caller is a teacher.
        ...(ownerTeacherId
          ? { teacherId: ownerTeacherId }
          : {}),
      },
      select: { id: true },
    });
    if (!chapter) {
      throw new AppError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
    }

    const code = await this.generateCode();

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const promoCode = await prisma.promoCode.create({
      data: { code, createdById, chapterId, expiresAt },
      select: promoCodePublicFields,
    });

    return promoCode as PromoCodeResponseDTO;
  }

  /**
   * List promo codes. When `ownerTeacherId` is provided (an OPERATION caller)
   * the list is scoped to codes that teacher created — a teacher never sees
   * another teacher's (or the admin's) promo codes. When omitted (ADMIN) all
   * codes are returned (global).
   */
  public async findAll(
    params: ListPromoCodesQuery,
    ownerTeacherId?: string,
  ): Promise<PaginatedPromoCodes> {
    const { page, limit, isUsed } = params;
    const where = {
      ...(isUsed === undefined ? {} : { isUsed }),
      ...(ownerTeacherId ? { createdById: ownerTeacherId } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.promoCode.count({ where }),
      prisma.promoCode.findMany({
        where,
        select: promoCodeListFields,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      data: items as unknown as PromoCodeListItemDTO[],
    };
  }

  public async validate(code: string, chapterId?: string): Promise<PromoCodeValidationResult> {
    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: { isUsed: true, expiresAt: true, chapterId: true },
    });

    if (!promoCode) {
      return { valid: false, reason: "CODE_NOT_FOUND" };
    }
    if (promoCode.isUsed) {
      return { valid: false, reason: "CODE_ALREADY_USED" };
    }
    if (promoCode.expiresAt && promoCode.expiresAt.getTime() < Date.now()) {
      return { valid: false, reason: "CODE_EXPIRED" };
    }
    if (chapterId && promoCode.chapterId !== chapterId) {
      return { valid: false, reason: "CODE_NOT_FOR_THIS_CHAPTER" };
    }

    return { valid: true };
  }

  public async redeem(
    code: string,
    studentId: string,
    chapterId: string,
    locale: Locale = "en",
  ): Promise<RedeemResult> {
    const m = REDEEM_MESSAGES[locale];

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, deletedAt: true },
    });
    if (!chapter || chapter.deletedAt) {
      throw new AppError(m.chapterNotFound, 404, "CHAPTER_NOT_FOUND");
    }

    const visible = await isTeacherVisibleForDiscovery(chapterId);
    if (!visible) {
      throw new AppError(
        "هذا المحتوى غير متاح حاليًا",
        403,
        "COURSE_NOT_AVAILABLE",
      );
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_chapterId: { studentId, chapterId } },
      select: { id: true },
    });
    if (existingEnrollment) {
      throw new AppError(m.alreadyEnrolled, 400, "ALREADY_ENROLLED");
    }

    const validation = await this.validate(code, chapterId);
    if (!validation.valid) {
      const reasonMap: Record<string, { msg: string; code: string }> = {
        CODE_ALREADY_USED: { msg: m.alreadyUsed, code: "CODE_ALREADY_USED" },
        CODE_NOT_FOR_THIS_CHAPTER: { msg: m.notForThisChapter, code: "CODE_NOT_FOR_THIS_CHAPTER" },
      };
      const entry = reasonMap[validation.reason!] ?? { msg: m.invalidCode, code: "INVALID_CODE" };
      throw new AppError(entry.msg, 400, entry.code);
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!promoCode) {
      throw new AppError(m.invalidCode, 400, "INVALID_CODE");
    }

    const usedAt = new Date();

    const enrollment = await prisma.$transaction(async (tx) => {
      const claimed = await tx.promoCode.updateMany({
        where: {
          id: promoCode.id,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: usedAt } }],
        },
        data: { isUsed: true, usedByStudentId: studentId, usedAt },
      });

      if (claimed.count === 0) {
        throw new AppError(m.alreadyUsed, 400, "CODE_ALREADY_USED");
      }

      try {
        return await tx.enrollment.create({
          data: {
            studentId,
            chapterId,
            price: 0,
            paymentMethod: "PROMO",
            promoCodeId: promoCode.id,
          },
          select: enrollmentPublicFields,
        });
      } catch (e) {
        if ((e as { code?: string } | null)?.code === "P2002") {
          throw new AppError(m.alreadyEnrolled, 400, "ALREADY_ENROLLED");
        }
        throw e;
      }
    });

    return {
      enrollment: this.toEnrollmentResponseDTO(enrollment),
      promoCode: { code, isUsed: true, usedAt },
    };
  }

  private toEnrollmentResponseDTO(
    enrollment: {
      price: unknown;
      chapter: { price: unknown };
    } & Record<string, unknown>,
  ): EnrollmentResponseDTO {
    return {
      ...enrollment,
      price: Number(enrollment.price),
      chapter: {
        ...enrollment.chapter,
        price:
          enrollment.chapter.price !== null
            ? Number(enrollment.chapter.price)
            : null,
      },
    } as unknown as EnrollmentResponseDTO;
  }
}
