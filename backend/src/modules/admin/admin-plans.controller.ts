import type { Request, Response, NextFunction } from "express";
import { okResponse, errorResponse } from "../../shared/utils/apiResponse.js";
import { adminPlansService } from "./admin-plans.service.js";
import type { ListPlansQuery } from "./admin-plans.validation.js";

export class AdminPlansController {
  public list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.validated?.query ?? req.query) as ListPlansQuery;
      const result = await adminPlansService.listPlans(query);
      res.status(200).json(okResponse("Plans fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.planId as string;
      const result = await adminPlansService.getPlanDetail(planId);
      if (!result) {
        res.status(404).json(errorResponse("Plan not found", 404));
        return;
      }
      res.status(200).json(okResponse("Plan detail fetched successfully", result));
    } catch (error) {
      next(error);
    }
  };

  // ── Mutations ──

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.validated?.body ?? req.body) as Record<string, unknown>;
      const result = await adminPlansService.createPlan(body as any, req.user!.id);
      res.status(201).json(okResponse("Plan created successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.planId as string;
      const body = (req.validated?.body ?? req.body) as Record<string, unknown>;
      const result = await adminPlansService.updatePlan(planId, body as any, req.user!.id);
      res.status(200).json(okResponse("Plan updated successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.planId as string;
      const body = (req.validated?.body ?? req.body) as Record<string, unknown>;
      const result = await adminPlansService.changeStatus(planId, body as any, req.user!.id);
      res.status(200).json(okResponse("Plan status changed successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public changeRecommended = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.planId as string;
      const body = (req.validated?.body ?? req.body) as Record<string, unknown>;
      const result = await adminPlansService.changeRecommended(planId, body as any, req.user!.id);
      res.status(200).json(okResponse("Plan recommended status changed successfully", result));
    } catch (error) {
      next(error);
    }
  };

  public reorder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.validated?.body ?? req.body) as Record<string, unknown>;
      await adminPlansService.reorder(body as any, req.user!.id);
      res.status(200).json(okResponse("Plans reordered successfully"));
    } catch (error) {
      next(error);
    }
  };
}
