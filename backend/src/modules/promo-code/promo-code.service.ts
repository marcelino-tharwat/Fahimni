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

/** Result of a successful redemption: the new enrollment + safe promo summary. */
export interface RedeemResult {
  enrollment: EnrollmentResponseDTO;
  promoCode: { code: string; isUsed: boolean; usedAt: Date };
}

// Uppercase alphanumeric, minus visually ambiguous characters (0/O, 1/I/L).
// Exported so the redeem DTO validates against the exact same alphabet/length.
export const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 10;

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
   * STORY-53 — Redeem a promo code for a chapter as the authenticated student.
   *
   * Checks are ordered so an invalid chapter or an already-enrolled student is
   * rejected BEFORE any code is consumed. The code is then claimed and the
   * enrollment created inside a single transaction so they succeed or fail
   * together:
   *  - the claim's `isUsed: false` + expiry guard means a concurrent redeem of
   *    the SAME code updates 0 rows → safe "already used" (Case A);
   *  - the enrollment's unique (studentId, chapterId) constraint means a
   *    concurrent redeem of TWO codes for the SAME chapter throws on create →
   *    we map it to "already enrolled" and the transaction rolls back the claim,
   *    so the losing code stays unused (Case B).
   *
   * Domain failures return 400 with locale-aware messages.
   */
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
      throw new AppError(m.chapterNotFound, 404);
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_chapterId: { studentId, chapterId } },
      select: { id: true },
    });
    if (existingEnrollment) {
      throw new AppError(m.alreadyEnrolled, 400);
    }

    const validation = await this.validate(code);
    if (!validation.valid) {
      throw new AppError(
        validation.reason === "CODE_ALREADY_USED"
          ? m.alreadyUsed
          : m.invalidCode,
        400,
      );
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!promoCode) {
      throw new AppError(m.invalidCode, 400);
    }

    const usedAt = new Date();

    const enrollment = await prisma.$transaction(async (tx) => {
      // Atomically claim the code (unused + not expired). A concurrent redeem of
      // the same code updates 0 rows and is rejected as already used.
      const claimed = await tx.promoCode.updateMany({
        where: {
          id: promoCode.id,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: usedAt } }],
        },
        data: { isUsed: true, usedByStudentId: studentId, usedAt },
      });

      if (claimed.count === 0) {
        throw new AppError(m.alreadyUsed, 400);
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
        // Unique (studentId, chapterId) violation → already enrolled. Throwing
        // here rolls back the code claim above, so the code remains unused.
        if ((e as { code?: string } | null)?.code === "P2002") {
          throw new AppError(m.alreadyEnrolled, 400);
        }
        throw e;
      }
    });

    return {
      enrollment: this.toEnrollmentResponseDTO(enrollment),
      promoCode: { code, isUsed: true, usedAt },
    };
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
