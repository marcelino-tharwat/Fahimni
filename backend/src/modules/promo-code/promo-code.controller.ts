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

      const promoCode = await promoCodeService.create(createdById);

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
      // Express 5 exposes req.query as read-only, so the list query is validated
      // here (not via validateRequest); the thrown ZodError is handled by the
      // global error handler exactly as the validate middleware would.
      const query = listPromoCodesSchema.parse(req.query);

      const result = await promoCodeService.findAll(query);

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

      const result = await promoCodeService.validate(code);

      res
        .status(200)
        .json(okResponse<PromoCodeValidationResult>(
          "Promo code validation result",
          result,
        ));
    },
  );

  /**
   * STORY-53 canonical: POST /api/promo-codes/redeem  body: { code, chapterId }.
   * Student id always from auth; never from the body.
   */
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
   * Compatibility alias retained from STORY-52: POST /api/promo-codes/:code/redeem.
   * Delegates to the same shared redemption service method as the canonical route.
   */
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
