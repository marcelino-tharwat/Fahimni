import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { StageService } from "./stage.service.js";
import type { StageResponseDTO } from "./stage.types.js";
import type { CreateStageInput, UpdateStageInput, ReorderInput } from "./stage.validation.js";

const stageService = new StageService();

export class StageController {
  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const stages = await stageService.list(req.user!.id);

      res
        .status(200)
        .json(okResponse<StageResponseDTO[]>(
          "Stages fetched successfully",
          stages,
        ));
    },
  );

  public getById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid stage ID", 400));
      }

      const stage = await stageService.getById(id, req.user!.id);

      res
        .status(200)
        .json(okResponse<StageResponseDTO>(
          "Stage fetched successfully",
          stage,
        ));
    },
  );

  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as CreateStageInput;
      const stage = await stageService.create(input, req.user!.id);

      res
        .status(201)
        .json(okResponse<StageResponseDTO>(
          "Stage created successfully",
          stage,
        ));
    },
  );

  public update = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid stage ID", 400));
      }

      const input = req.body as UpdateStageInput;
      const stage = await stageService.update(id, req.user!.id, input);

      res
        .status(200)
        .json(okResponse<StageResponseDTO>(
          "Stage updated successfully",
          stage,
        ));
    },
  );

  public reorder = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const ids = req.body as ReorderInput;
      const items = await stageService.reorder(ids, req.user!.id);

      res
        .status(200)
        .json(okResponse<StageResponseDTO[]>(
          "Stages reordered successfully",
          items,
        ));
    },
  );

  public delete = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid stage ID", 400));
      }

      const force = req.query.force === "true";
      await stageService.delete(id, req.user!.id, force);

      res.status(200).json(okResponse("Stage deleted successfully"));
    },
  );
}
