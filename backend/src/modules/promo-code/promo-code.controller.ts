import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { PromoCodeService } from "./promo-code.service.js";
import type {
  PromoCodeResponseDTO,
  PromoCodeValidationResult,
  PaginatedPromoCodes,
} from "./promo-code.types.js";
import type { EnrollmentResponseDTO } from "../enrollment/enrollment.types.js";
import { listPromoCodesSchema } from "./promo-code.validation.js";
import type { RedeemPromoCodeInput } from "./promo-code.validation.js";

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

  public redeemPromoCode = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const code = req.params.code as string;
      const studentId = req.user!.id;
      // The service requires a chapter to enroll into (Enrollment.chapterId is
      // NOT NULL); the code comes from the route param, the student from the
      // auth context, and the target chapter from the validated request body.
      const { chapterId } = req.body as RedeemPromoCodeInput;

      const enrollment = await promoCodeService.redeem(
        code,
        studentId,
        chapterId,
      );

      res
        .status(201)
        .json(okResponse<EnrollmentResponseDTO>(
          "Promo code redeemed successfully",
          enrollment,
        ));
    },
  );
}
