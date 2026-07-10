import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { teacherWalletService } from "./teacher-wallet.service.js";
import type {
  TeacherWalletDTO,
  PayoutProfileDTO,
  TeacherWithdrawalListItemDTO,
} from "./teacher-wallet.types.js";
import type {
  CreateWithdrawalInput,
  UpdatePayoutProfileInput,
} from "./teacher-wallet.validation.js";

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

  public listWithdrawals = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const withdrawals = await teacherWalletService.listWithdrawals(req.user!.id);
      res
        .status(200)
        .json(
          okResponse<TeacherWithdrawalListItemDTO[]>(
            "Withdrawals fetched successfully",
            withdrawals,
          ),
        );
    },
  );

  public createWithdrawal = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as CreateWithdrawalInput;
      const created = await teacherWalletService.createWithdrawal(req.user!.id, input);
      res
        .status(201)
        .json(
          okResponse<TeacherWithdrawalListItemDTO>(
            "Withdrawal request submitted successfully",
            created,
          ),
        );
    },
  );

  public cancelWithdrawal = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { withdrawalId } = req.params as { withdrawalId: string };
      const updated = await teacherWalletService.cancelWithdrawal(req.user!.id, withdrawalId);
      res
        .status(200)
        .json(
          okResponse<TeacherWithdrawalListItemDTO>(
            "Withdrawal request cancelled successfully",
            updated,
          ),
        );
    },
  );
}
