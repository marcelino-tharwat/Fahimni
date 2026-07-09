import type { BillingInterval, SubscriptionStatus, SubscriptionRequestStatus, AiUsageType } from "../../generated/prisma/index.js";

export interface PlanLimitDTO {
  used: number;
  limit: number;
  remaining: number;
}

export interface UsageSummaryDTO {
  periodStart: string;
  periodEnd: string;
  aiQuizGenerations: PlanLimitDTO;
  aiEssayGradings: PlanLimitDTO;
  aiContentGenerations: PlanLimitDTO;
  students: { used: number; limit: number };
  storageMb: { used: number; limit: number };
}

export interface PlanPublicDTO {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isRecommended: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, unknown>;
}

export interface CurrentPlanDTO {
  id: string;
  code: string;
  displayName: string;
}

export interface SubscriptionDTO {
  id: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}

export interface PendingRequestDTO {
  id: string;
  planCode: string;
  status: SubscriptionRequestStatus;
  createdAt: string;
}

export interface PendingPaymentInfoDTO {
  id: string;
  planId: string;
  planCode: string;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  createdAt: string;
}

export interface SubscriptionMeResponse {
  currentPlan: CurrentPlanDTO;
  subscription: SubscriptionDTO | null;
  usage: UsageSummaryDTO;
  pendingRequest: PendingRequestDTO | null;
  /** Latest pending online payment (paid checkout awaiting confirmation). */
  pendingPayment: PendingPaymentInfoDTO | null;
  effectivePlanCode: string;
  // Entitlement (single source of truth). FREE_PLAN = approved teacher with no
  // active paid subscription → full access under FREE limits, NOT blocked.
  accessState: "PENDING_REVIEW" | "REJECTED" | "NOT_APPROVED" | "FREE_PLAN" | "PAID_PLAN";
  entitlementSource: "DEFAULT_FREE_PLAN" | "ACTIVE_SUBSCRIPTION" | null;
  paymentRequired: boolean;
  upgradeAvailable: boolean;
}

export interface CreateRequestInput {
  planId: string;
  billingInterval: BillingInterval;
}

export interface CreateRequestResponse {
  request: {
    id: string;
    status: SubscriptionRequestStatus;
    planId: string;
    createdAt: string;
  };
  message: string;
}

export const USAGE_TYPE_LIMIT_MAP: Record<AiUsageType, keyof typeof DEFAULT_LIMITS> = {
  AI_QUIZ_GENERATION: "aiQuizGenerationsPerMonth",
  AI_ESSAY_GRADING: "aiEssayGradingsPerMonth",
  AI_CONTENT_GENERATION: "aiContentGenerationsPerMonth",
  AI_LESSON_SUMMARY: "aiLessonSummariesPerMonth",
  AI_QUESTION_EXPLANATION: "aiQuestionExplanationsPerMonth",
};

export const DEFAULT_LIMITS = {
  aiQuizGenerationsPerMonth: 5,
  aiEssayGradingsPerMonth: 10,
  aiContentGenerationsPerMonth: 0,
  aiLessonSummariesPerMonth: 0,
  aiQuestionExplanationsPerMonth: 0,
  maxStudents: 50,
  maxCourses: 3,
  maxQuizzes: 20,
  storageMb: 500,
  analyticsAccess: false,
  studentEngagementAnalytics: false,
  pdfDownloadTracking: true,
  contentProtection: true,
  prioritySupport: false,
} as const;
