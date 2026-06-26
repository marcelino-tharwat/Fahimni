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
  PromoCodeInvalidReason,
  PaginatedPromoCodes,
} from "./promo-code.types.js";
import { enrollmentPublicFields } from "../enrollment/enrollment.types.js";
import type { EnrollmentResponseDTO } from "../enrollment/enrollment.types.js";
import type { ListPromoCodesQuery } from "./promo-code.validation.js";

// Uppercase alphanumeric, minus visually ambiguous characters (0/O, 1/I/L).
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 10;

// Human-readable message for each machine-readable validation reason, used when
// a failed validation is surfaced as an error (e.g. on redeem).
const INVALID_REASON_MESSAGES: Record<PromoCodeInvalidReason, string> = {
  CODE_NOT_FOUND: "Promo code not found",
  CODE_ALREADY_USED: "Promo code has already been used",
  CODE_EXPIRED: "Promo code has expired",
};

export class PromoCodeService {
  /**
   * Generate a cryptographically random 8-char code from the unambiguous
   * charset, retrying on the (extremely unlikely) event of a DB collision.
   */
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

  /**
   * Draw CODE_LENGTH characters from CODE_CHARSET using random bytes. Bytes are
   * rejection-sampled (values in the final, non-whole block are discarded) so
   * every character is uniformly distributed — no modulo bias toward the start
   * of the charset.
   */
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

  /** Create a promo code on behalf of a support agent; expires 1 year from now. */
  public async create(createdById: string): Promise<PromoCodeResponseDTO> {
    const code = await this.generateCode();

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const promoCode = await prisma.promoCode.create({
      data: { code, createdById, expiresAt },
      select: promoCodePublicFields,
    });

    return promoCode as PromoCodeResponseDTO;
  }

  /** Paginated list of promo codes, newest first, optionally filtered by usage. */
  public async findAll(
    params: ListPromoCodesQuery,
  ): Promise<PaginatedPromoCodes> {
    const { page, limit, isUsed } = params;
    const where = isUsed === undefined ? {} : { isUsed };

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

  /** Check whether a code exists, is unused, and is not expired. */
  public async validate(code: string): Promise<PromoCodeValidationResult> {
    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: { isUsed: true, expiresAt: true },
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

    return { valid: true };
  }

  /**
   * Redeem a code: validate it, then in a single transaction atomically claim
   * the code (guarding against a concurrent redeem) and create a free PROMO
   * enrollment for the given chapter. Returns the created enrollment.
   */
  public async redeem(
    code: string,
    studentId: string,
    chapterId: string,
  ): Promise<EnrollmentResponseDTO> {
    const validation = await this.validate(code);
    if (!validation.valid) {
      const message = validation.reason
        ? INVALID_REASON_MESSAGES[validation.reason]
        : "Invalid promo code";
      throw new AppError(message, 400);
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, deletedAt: true },
    });
    if (!chapter || chapter.deletedAt) {
      throw new AppError("Chapter not found", 404);
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_chapterId: { studentId, chapterId } },
      select: { id: true },
    });
    if (existingEnrollment) {
      throw new AppError("You are already enrolled in this chapter", 409);
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!promoCode) {
      throw new AppError("Promo code not found", 404);
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      // Atomically claim the code: the `isUsed: false` guard means a concurrent
      // redeem of the same code updates 0 rows and is rejected below.
      const claimed = await tx.promoCode.updateMany({
        where: { id: promoCode.id, isUsed: false },
        data: {
          isUsed: true,
          usedByStudentId: studentId,
          usedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new AppError("Promo code has already been used", 409);
      }

      return tx.enrollment.create({
        data: {
          studentId,
          chapterId,
          price: 0,
          paymentMethod: "PROMO",
          promoCodeId: promoCode.id,
        },
        select: enrollmentPublicFields,
      });
    });

    return this.toEnrollmentResponseDTO(enrollment);
  }

  /** Normalize Decimal/Float prices to numbers for the enrollment response shape. */
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
