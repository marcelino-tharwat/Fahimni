import type { Request, Response } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminPromoCodesService } from "./admin-promo-codes.service.js";
import type {
  CreatePromoCodeInput,
  ListPromoCodesQuery,
  StatusChangeInput,
  UpdatePromoCodeInput,
} from "./admin-promo-codes.validation.js";

export class AdminPromoCodesController {
  list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validated?.query ?? req.query) as ListPromoCodesQuery;
    const result = await adminPromoCodesService.list(query);
    res.status(200).json(okResponse("Promo codes fetched successfully", result));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await adminPromoCodesService.getById(req.params.promoId as string);
    res.status(200).json(okResponse("Promo code fetched successfully", result));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = (req.validated?.body ?? req.body) as CreatePromoCodeInput;
    const result = await adminPromoCodesService.create(req.user!.id, body);
    res.status(201).json(okResponse("Promo code created successfully", result));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const body = (req.validated?.body ?? req.body) as UpdatePromoCodeInput;
    const result = await adminPromoCodesService.update(req.params.promoId as string, body);
    res.status(200).json(okResponse("Promo code updated successfully", result));
  };

  changeStatus = async (req: Request, res: Response): Promise<void> => {
    const body = (req.validated?.body ?? req.body) as StatusChangeInput;
    const result = await adminPromoCodesService.changeStatus(req.params.promoId as string, body.isActive);
    res.status(200).json(okResponse("Promo code status updated successfully", result));
  };
}
