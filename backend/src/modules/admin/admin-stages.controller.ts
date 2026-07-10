import type { Request, Response, NextFunction } from "express";
import { okResponse, errorResponse } from "../../shared/utils/apiResponse.js";
import { adminStagesService } from "./admin-stages.service.js";
import type { ListStagesQuery, CreateStageInput, UpdateStageInput } from "./admin-stages.validation.js";

export class AdminStagesController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListStagesQuery;
      const result = await adminStagesService.list(query);
      res.status(200).json(okResponse("Stages fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await adminStagesService.getById(id);
      if (!result) {
        res.status(404).json(errorResponse("Stage not found", 404));
        return;
      }
      res.status(200).json(okResponse("Stage fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.validated?.body ?? req.body) as CreateStageInput;
      const result = await adminStagesService.create(body, req.user!.id);
      res.status(201).json(okResponse("Stage created successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const body = (req.validated?.body ?? req.body) as UpdateStageInput;
      const result = await adminStagesService.update(id, body, req.user!.id);
      res.status(200).json(okResponse("Stage updated successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      await adminStagesService.delete(id, req.user!.id);
      res.status(200).json(okResponse("Stage deleted successfully"));
    } catch (error) {
      next(error);
    }
  };

  public reorder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ids = req.body as string[];
      const result = await adminStagesService.reorder(ids, req.user!.id);
      res.status(200).json(okResponse("Stages reordered successfully", result));
    } catch (error) {
      next(error);
    }
  };
}
