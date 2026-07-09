import type { Request, Response } from "express";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { adminSubscriptionsService } from "./admin-subscriptions.service.js";
import type {
  ApproveSubscriptionRequestInput,
  ListAiUsageQuery,
  ListEntitlementsQuery,
  ListPaymentsQuery,
  ListSubscriptionRequestsQuery,
  ListSubscriptionsQuery,
  RejectSubscriptionRequestInput,
} from "./admin-subscriptions.validation.js";

/** Read `req.validated.query` (populated by validateRequest) with a safe fallback. */
function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? req.query) as T;
}

export class AdminSubscriptionsController {
  listEntitlements = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.listEntitlements(
      validatedQuery<ListEntitlementsQuery>(req),
    );
    res.status(200).json(okResponse("Teacher entitlements fetched successfully", result));
  };

  listSubscriptions = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.listSubscriptions(
      validatedQuery<ListSubscriptionsQuery>(req),
    );
    res.status(200).json(okResponse("Teacher subscriptions fetched successfully", result));
  };

  getSubscriptionDetail = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.getSubscriptionDetail(
      req.params.subscriptionId as string,
    );
    res.status(200).json(okResponse("Subscription detail fetched successfully", result));
  };

  listPayments = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.listPayments(
      validatedQuery<ListPaymentsQuery>(req),
    );
    res.status(200).json(okResponse("Subscription payments fetched successfully", result));
  };

  getPaymentDetail = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.getPaymentDetail(
      req.params.paymentId as string,
    );
    res.status(200).json(okResponse("Payment detail fetched successfully", result));
  };

  listRequests = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.listSubscriptionRequests(
      validatedQuery<ListSubscriptionRequestsQuery>(req),
    );
    res.status(200).json(okResponse("Subscription requests fetched successfully", result));
  };

  approveRequest = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.approveRequest(
      req.params.requestId as string,
      req.user!.id,
      (req.validated?.body ?? req.body) as ApproveSubscriptionRequestInput,
    );
    res.status(200).json(okResponse("Subscription request approved", result));
  };

  rejectRequest = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.rejectRequest(
      req.params.requestId as string,
      req.user!.id,
      (req.validated?.body ?? req.body) as RejectSubscriptionRequestInput,
    );
    res.status(200).json(okResponse("Subscription request rejected", result));
  };

  getAiUsage = async (req: Request, res: Response): Promise<void> => {
    const result = await adminSubscriptionsService.listAiUsage(
      validatedQuery<ListAiUsageQuery>(req),
    );
    res.status(200).json(okResponse("AI usage overview fetched successfully", result));
  };
}
