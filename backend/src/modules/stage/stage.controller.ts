import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { StageService } from "./stage.service.js";
import type { StageResponseDTO } from "./stage.types.js";

const stageService = new StageService();

function requestLocale(req: Request): "ar" | "en" {
  return req.headers["accept-language"]?.startsWith("en") ? "en" : "ar";
}

export class StageController {
  /**
   * GET /stages/public — no auth required. Returns all active non-deleted stages
   * in sort order for the signup dropdown.
   */
  public listPublic = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const stages = await stageService.listPublic(requestLocale(req));

      res
        .status(200)
        .json(okResponse<Pick<StageResponseDTO, "id" | "name" | "sortOrder">[]>(
          "Stages fetched successfully",
          stages,
        ));
    },
  );

  /**
   * GET /stages — teacher listing of all active stages (admin-managed).
   */
  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const stages = await stageService.list(requestLocale(req));

      res
        .status(200)
        .json(okResponse<StageResponseDTO[]>(
          "Stages fetched successfully",
          stages,
        ));
    },
  );

  /**
   * GET /stages/:id — get one active stage.
   */
  public getById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid stage ID", 400));
      }

      const stage = await stageService.getById(id, requestLocale(req));

      res
        .status(200)
        .json(okResponse<StageResponseDTO>(
          "Stage fetched successfully",
          stage,
        ));
    },
  );
}
