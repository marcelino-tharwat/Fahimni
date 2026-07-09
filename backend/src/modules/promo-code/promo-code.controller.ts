import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
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
