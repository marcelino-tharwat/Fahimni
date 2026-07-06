export interface TeacherPlan {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isRecommended: boolean;
  features: string[];
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

export interface SubscriptionMeResponse {
  currentPlan: CurrentPlanInfo;
  subscription: SubscriptionInfo | null;
  usage: UsageSummary;
  pendingRequest: PendingRequestInfo | null;
  effectivePlanCode: string;
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
