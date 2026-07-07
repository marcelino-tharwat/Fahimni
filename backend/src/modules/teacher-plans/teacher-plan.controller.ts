import type { Request, Response, NextFunction } from "express";
import { TeacherPlanService } from "./teacher-plan.service.js";
import { TeacherPlanPolicyService } from "./teacher-plan-policy.service.js";
import { teacherSubscriptionPaymentService } from "./teacher-subscription-payment.service.js";
import { getTeacherPlanMessage } from "./teacher-plan.i18n.js";

const planService = new TeacherPlanService();
const policyService = new TeacherPlanPolicyService();

export class TeacherPlanController {

  async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";
      const plans = await planService.getActivePlans(locale);
      res.json({ plans });
    } catch (err) {
      next(err);
    }
  }

  async getMySubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.id;
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";
      const summary = await planService.getSubscriptionSummary(teacherId, locale);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.id;
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";
      const { planId, billingInterval } = req.body;
      const result = await planService.createSubscriptionRequest(
        teacherId,
        { planId, billingInterval },
        locale,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.id;
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";
      const { planId, billingInterval } = req.body;
      const result = await teacherSubscriptionPaymentService.createCheckout(
        teacherId,
        { planId, billingInterval },
        locale,
      );
      res.status(201).json({
        ...result,
        message: getTeacherPlanMessage("CHECKOUT_CREATED", locale),
      });
    } catch (err) {
      next(err);
    }
  }

  async listMyRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.id;
      const requests = await planService.getTeacherRequests(teacherId);
      res.json({ requests });
    } catch (err) {
      next(err);
    }
  }

  async getMyUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.id;
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";
      const summary = await planService.getSubscriptionSummary(teacherId, locale);
      res.json({ usage: summary.usage, currentPlan: summary.currentPlan, effectivePlanCode: summary.effectivePlanCode });
    } catch (err) {
      next(err);
    }
  }
}
