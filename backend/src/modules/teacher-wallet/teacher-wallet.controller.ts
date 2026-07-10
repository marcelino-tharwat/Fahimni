import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { teacherWalletService } from "./teacher-wallet.service.js";
import type { TeacherWalletDTO, PayoutProfileDTO } from "./teacher-wallet.types.js";
import type { UpdatePayoutProfileInput } from "./teacher-wallet.validation.js";

export class TeacherWalletController {
  public getWallet = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const wallet = await teacherWalletService.getWallet(req.user!.id);
      res
        .status(200)
        .json(okResponse<TeacherWalletDTO>("Wallet fetched successfully", wallet));
    },
  );

  public getPayoutProfile = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const profile = await teacherWalletService.getPayoutProfile(req.user!.id);
      res
        .status(200)
        .json(okResponse<PayoutProfileDTO>("Payout profile fetched successfully", profile));
    },
  );

  public updatePayoutProfile = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as UpdatePayoutProfileInput;
      const updated = await teacherWalletService.updatePayoutProfile(req.user!.id, input);
      res
        .status(200)
        .json(okResponse<PayoutProfileDTO>("Payout profile updated successfully", updated));
    },
  );
}
