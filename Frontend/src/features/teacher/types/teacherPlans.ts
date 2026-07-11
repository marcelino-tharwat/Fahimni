export interface TeacherPlan {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isRecommended: boolean;
  features: Record<string, boolean>;
  limits: Record<string, unknown>;
}

export interface PlanLimit {
  used: number;
  limit: number;
  remaining: number;
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  aiQuizGenerations: PlanLimit;
  aiEssayGradings: PlanLimit;
  aiContentGenerations: PlanLimit;
  students: { used: number; limit: number };
  storageMb: { used: number; limit: number };
}

export interface CurrentPlanInfo {
  id: string;
  code: string;
  displayName: string;
}

export interface SubscriptionInfo {
  id: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  billingInterval: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}

export interface PendingRequestInfo {
  id: string;
  planCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
}

export interface PendingPaymentInfo {
  id: string;
  planId: string;
  planCode: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  createdAt: string;
}

export type TeacherAccessState =
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'NOT_APPROVED'
  | 'FREE_PLAN'
  | 'PAID_PLAN';

export interface SubscriptionMeResponse {
  currentPlan: CurrentPlanInfo;
  subscription: SubscriptionInfo | null;
  usage: UsageSummary;
  pendingRequest: PendingRequestInfo | null;
  pendingPayment: PendingPaymentInfo | null;
  effectivePlanCode: string;
  /** Entitlement single source of truth (mirrors backend). FREE_PLAN = approved
   * teacher with no active paid subscription → full access, NOT blocked. */
  accessState: TeacherAccessState;
  entitlementSource: 'DEFAULT_FREE_PLAN' | 'ACTIVE_SUBSCRIPTION' | null;
  paymentRequired: boolean;
  upgradeAvailable: boolean;
}

export interface CheckoutInput {
  planId: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  promoCode?: string;
}

export interface CheckoutResponse {
  paymentId: string;
  orderId: string;
  checkoutUrl: string | null;
  amount: number;
  originalAmount?: number;
  discount?: number;
  promoCode?: string | null;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  status: string;
  message: string;
}

export interface PromoPreviewInput {
  planId: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  promoCode: string;
}

export interface PromoPreviewResponse {
  originalAmount: number;
  discount: number;
  amountAfter: number;
  currency: string;
  promoCode: string;
}

export interface CreateRequestInput {
  planId: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
}

export interface CreateRequestResponse {
  request: {
    id: string;
    status: string;
    planId: string;
    createdAt: string;
  };
  message: string;
}
