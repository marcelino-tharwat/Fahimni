import type { Request, Response } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminRevenueService } from "./admin-revenue.service.js";
import type {
  ListCoursePaymentsQuery,
  ListSubscriptionPaymentsQuery,
  RevenueRankingQuery,
} from "./admin-revenue.validation.js";

function q<T>(req: Request): T {
  return (req.validated?.query ?? req.query) as T;
}

export class AdminRevenueController {
  getSummary = async (_req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.getSummary();
    res.status(200).json(okResponse("Revenue summary fetched successfully", result));
  };

  getByTeacher = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.getRevenueByTeacher(q<RevenueRankingQuery>(req));
    res.status(200).json(okResponse("Revenue by teacher fetched successfully", result));
  };

  getByChapter = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.getRevenueByChapter(q<RevenueRankingQuery>(req));
    res.status(200).json(okResponse("Revenue by chapter fetched successfully", result));
  };

  listCoursePayments = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.listCoursePayments(q<ListCoursePaymentsQuery>(req));
    res.status(200).json(okResponse("Course payments fetched successfully", result));
  };

  getCoursePayment = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.getCoursePayment(req.params.paymentId as string);
    res.status(200).json(okResponse("Course payment detail fetched successfully", result));
  };

  listSubscriptionPayments = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.listSubscriptionPayments(
      q<ListSubscriptionPaymentsQuery>(req),
    );
    res.status(200).json(okResponse("Subscription payments fetched successfully", result));
  };

  getSubscriptionPayment = async (req: Request, res: Response): Promise<void> => {
    const result = await adminRevenueService.getSubscriptionPayment(req.params.paymentId as string);
    res.status(200).json(okResponse("Subscription payment detail fetched successfully", result));
  };
}
