export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface TeacherRef {
  id: string;
  fullName: string;
  email: string;
}
export interface PlanRef {
  id: string;
  code: string;
  displayName: string;
}

export type EntitlementSource = 'DEFAULT_FREE_PLAN' | 'ACTIVE_SUBSCRIPTION';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'PREMIUM';

export interface SubscriptionRef {
  id: string;
  status: string;
  billingInterval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}
export interface PendingPaymentRef {
  id: string;
  amount: number;
  currency: string;
  billingInterval: string;
  status: string;
  createdAt: string;
}

export interface TeacherEntitlementRow {
  teacher: TeacherRef;
  entitlementSource: EntitlementSource;
  currentPlan: PlanRef;
  activeSubscription: SubscriptionRef | null;
  pendingPayment: PendingPaymentRef | null;
  failedPaymentsCount: number;
  successfulPaymentsCount: number;
  confirmedSubscriptionRevenue: number;
}

export interface AdminSubscriptionListItem {
  id: string;
  teacher: TeacherRef;
  plan: PlanRef;
  status: SubscriptionStatus;
  billingInterval: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface AdminPaymentDTO {
  id: string;
  teacher: TeacherRef;
  plan: PlanRef;
  amount: number;
  currency: string;
  billingInterval: string;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminSubscriptionDetail extends AdminSubscriptionListItem {
  payments: AdminPaymentDTO[];
  successfulPaymentsCount: number;
  failedPaymentsCount: number;
  confirmedRevenue: number;
}

export interface AdminSubscriptionRequestItem {
  id: string;
  teacher: TeacherRef;
  plan: PlanRef;
  requestedInterval: string;
  status: RequestStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AiUsageTypeKey =
  | 'AI_QUIZ_GENERATION'
  | 'AI_ESSAY_GRADING'
  | 'AI_CONTENT_GENERATION'
  | 'AI_LESSON_SUMMARY'
  | 'AI_QUESTION_EXPLANATION';

export interface AiUsageRow {
  teacher: TeacherRef;
  totalEvents: number;
  totalUnits: number;
  currentMonthUnits: number;
  byType: Record<AiUsageTypeKey, number>;
}
export interface AiUsageTotals {
  totalEvents: number;
  totalUnits: number;
  byType: Record<AiUsageTypeKey, number>;
}
export interface AiUsageResponse extends Paginated<AiUsageRow> {
  totals: AiUsageTotals;
}

export interface ListQuery {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  planCode?: PlanCode;
  entitlementSource?: EntitlementSource;
  usageType?: AiUsageTypeKey;
}
