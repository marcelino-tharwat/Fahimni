import { prisma } from "../../config/database.js";
import { TeacherPlanService } from "./teacher-plan.service.js";

export type TeacherAccessState =
  | "PENDING_REVIEW"
  | "REJECTED"
  | "NOT_APPROVED"
  | "FREE_PLAN"
  | "PAID_PLAN";

export type EntitlementSource = "DEFAULT_FREE_PLAN" | "ACTIVE_SUBSCRIPTION" | null;

export interface EntitlementPlan {
  id: string;
  code: string;
  displayName: string;
  limits: Record<string, unknown>;
  features: Record<string, boolean>;
}

export interface ActiveSubscriptionRef {
  id: string;
  status: string;
  billingInterval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface TeacherEntitlement {
  accessState: TeacherAccessState;
  canAccessTeacherFeatures: boolean;
  entitlementSource: EntitlementSource;
  currentPlan: EntitlementPlan | null;
  activeSubscription: ActiveSubscriptionRef | null;
  upgradeAvailable: boolean;
}

/**
 * Single source of truth for what a teacher is entitled to. An APPROVED teacher
 * with no ACTIVE paid subscription is NOT blocked — they fall back to the
 * canonical FREE plan (DEFAULT_FREE_PLAN). Only a Paymob-verified ACTIVE
 * subscription (period not lapsed) counts as paid; PENDING/FAILED payments and
 * TRIALING/expired subscriptions never grant a paid plan, but never remove FREE
 * access either. No fake subscription or payment is ever created here.
 */
export class TeacherPlanEntitlementService {
  constructor(private readonly plans = new TeacherPlanService()) {}

  /** The ACTIVE, non-lapsed paid subscription for a teacher (or null). */
  async getActivePaidSubscription(teacherId: string) {
    return prisma.teacherSubscription.findFirst({
      where: { teacherId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      orderBy: { currentPeriodEnd: "desc" },
      include: { plan: true },
    });
  }

  async resolve(
    teacherId: string,
    user?: { teacherApprovalState: string; status: string },
  ): Promise<TeacherEntitlement> {
    const u =
      user ??
      (await prisma.user.findUnique({
        where: { id: teacherId },
        select: { teacherApprovalState: true, status: true },
      }));

    const blocked = (accessState: TeacherAccessState): TeacherEntitlement => ({
      accessState,
      canAccessTeacherFeatures: false,
      entitlementSource: null,
      currentPlan: null,
      activeSubscription: null,
      upgradeAvailable: false,
    });

    if (!u) return blocked("NOT_APPROVED");
    if (u.teacherApprovalState === "PENDING_REVIEW") return blocked("PENDING_REVIEW");
    if (u.teacherApprovalState === "REJECTED") return blocked("REJECTED");
    if (u.teacherApprovalState !== "APPROVED" || u.status !== "ACTIVE") {
      return blocked("NOT_APPROVED");
    }

    const activeSub = await this.getActivePaidSubscription(teacherId);

    if (activeSub) {
      return {
        accessState: "PAID_PLAN",
        canAccessTeacherFeatures: true,
        entitlementSource: "ACTIVE_SUBSCRIPTION",
        currentPlan: {
          id: activeSub.plan.id,
          code: activeSub.plan.code,
          displayName: activeSub.plan.displayName,
          limits: parseJson<Record<string, unknown>>(activeSub.plan.limits) ?? {},
          features: parseJson<Record<string, boolean>>(activeSub.plan.features) ?? {},
        },
        activeSubscription: {
          id: activeSub.id,
          status: activeSub.status,
          billingInterval: activeSub.billingInterval,
          currentPeriodStart: activeSub.currentPeriodStart.toISOString(),
          currentPeriodEnd: activeSub.currentPeriodEnd.toISOString(),
        },
        upgradeAvailable: false,
      };
    }

    // Approved, active account, but no active paid subscription → FREE plan.
    const free = await this.plans.getPlanByCode("FREE");
    return {
      accessState: "FREE_PLAN",
      canAccessTeacherFeatures: true,
      entitlementSource: "DEFAULT_FREE_PLAN",
      currentPlan: free
        ? { id: free.id, code: free.code, displayName: free.displayName, limits: free.limits, features: free.features }
        : { id: "free-default", code: "FREE", displayName: "الباقة المجانية", limits: {}, features: {} },
      activeSubscription: null,
      upgradeAvailable: true,
    };
  }
}

function parseJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}

export const teacherPlanEntitlementService = new TeacherPlanEntitlementService();
