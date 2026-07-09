import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { platformPromoService } from "./platform-promo.service.js";
import { PromoCodeService } from "./promo-code.service.js";
import type {
  PromoCodeResponseDTO,
  PromoCodeValidationResult,
  PaginatedPromoCodes,
} from "./promo-code.types.js";
import { listPromoCodesSchema } from "./promo-code.validation.js";
import type { RedeemPromoCodeInput } from "./promo-code.validation.js";
import type { RedeemDtoInput } from "./dto/redeem.dto.js";
import type { RedeemResult } from "./promo-code.service.js";
import { REDEEM_MESSAGES, resolveLocale } from "./promo-code.i18n.js";

const promoCodeService = new PromoCodeService();

export class PromoCodeController {
  public createPromoCode = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const createdById = req.user!.id;
      const { chapterId } = req.body as { chapterId: string };

      // A teacher (OPERATION) may only create codes for their own chapters; an
      // ADMIN may target any chapter. Ownership is derived from the auth context.
      const ownerTeacherId =
        req.user!.role === "OPERATION" ? req.user!.id : undefined;

      const promoCode = await promoCodeService.create(
        createdById,
        chapterId,
        ownerTeacherId,
      );

      res
        .status(201)
        .json(okResponse<PromoCodeResponseDTO>(
          "Promo code created successfully",
          promoCode,
        ));
    },
  );

  public getAllPromoCodes = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const query = listPromoCodesSchema.parse(req.query);

      // A teacher (OPERATION) sees only their own codes; an ADMIN sees all.
      const ownerTeacherId =
        req.user!.role === "OPERATION" ? req.user!.id : undefined;

      const result = await promoCodeService.findAll(query, ownerTeacherId);

      res
        .status(200)
        .json(okResponse<PaginatedPromoCodes>(
          "Promo codes retrieved successfully",
          result,
        ));
    },
  );

  public validatePromoCode = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const code = req.params.code as string;
      const chapterId = req.query.chapterId as string | undefined;

      const result = await promoCodeService.validate(code, chapterId);

      res
        .status(200)
        .json(okResponse<PromoCodeValidationResult>(
          "Promo code validation result",
          result,
        ));
    },
  );

  public redeemByBody = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const { code, chapterId } = req.body as RedeemDtoInput;
      const locale = resolveLocale(req.headers["accept-language"]);

      const result = await promoCodeService.redeem(
        code,
        studentId,
        chapterId,
        locale,
      );

      res
        .status(201)
        .json(okResponse<RedeemResult>(REDEEM_MESSAGES[locale].success, result));
    },
  );

  /**
   * COURSE_PURCHASE discount preview. Validates a platform promo for a chapter
   * and returns the discounted pricing. Only COURSE_PURCHASE codes are accepted —
   * a TEACHER_PLAN code is rejected (PROMO_SCOPE_MISMATCH) by the shared validator.
   */
  public validateCourseDiscount = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const studentId = req.user!.id;
      const { code, chapterId } = req.body as { code: string; chapterId: string };

      const chapter = await prisma.chapter.findFirst({
        where: { id: chapterId, deletedAt: null },
        select: { id: true, price: true },
      });
      if (!chapter) {
        return next(new AppError("Chapter not found", 404, "CHAPTER_NOT_FOUND"));
      }
      const amount = Number(chapter.price ?? 0);

      const { promo, pricing } = await platformPromoService.validateAndPrice(code, {
        scope: "COURSE_PURCHASE",
        amount,
        userId: studentId,
      });

      res.status(200).json(
        okResponse("Promo code valid", {
          code: promo.code,
          scope: promo.scope,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          amountBefore: pricing.amountBefore,
          discount: pricing.discount,
          amountAfter: pricing.amountAfter,
          currency: promo.currency,
        }),
      );
    },
  );

  public redeemPromoCode = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const code = req.params.code as string;
      const studentId = req.user!.id;
      const { chapterId } = req.body as RedeemPromoCodeInput;
      const locale = resolveLocale(req.headers["accept-language"]);

      const result = await promoCodeService.redeem(
        code,
        studentId,
        chapterId,
        locale,
      );

      res
        .status(201)
        .json(okResponse<RedeemResult>(REDEEM_MESSAGES[locale].success, result));
    },
  );
}
