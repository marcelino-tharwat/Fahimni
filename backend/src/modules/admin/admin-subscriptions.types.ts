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

/** Safe subscription reference — no provider ids, no callbacks. */
export interface SubscriptionRef {
  id: string;
  status: string;
  billingInterval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}

/** Safe pending-payment reference — never exposes checkoutUrl/rawCallback/ids. */
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
  entitlementSource: "DEFAULT_FREE_PLAN" | "ACTIVE_SUBSCRIPTION";
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
  status: string;
  billingInterval: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
}

/** Safe payment DTO — the ONLY payment fields ever returned to the admin UI.
 * rawCallback, checkoutUrl, providerOrderId/providerTransactionId, and any
 * provider secret are intentionally excluded. */
export interface AdminPaymentDTO {
  id: string;
  teacher: TeacherRef;
  plan: PlanRef;
  amount: number;
  currency: string;
  billingInterval: string;
  status: string;
  provider: string;
  createdAt: string;
  /** Derived from updatedAt when the payment is SUCCESS; the schema has no
   * dedicated paidAt column, so this is null otherwise. */
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
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ManualActivationOutcome =
  | "MANUAL_SUBSCRIPTION_ACTIVATION_POLICY_PENDING";

export interface ApproveSubscriptionRequestResponse {
  request: AdminSubscriptionRequestItem;
  /** No paid subscription/payment is fabricated on approval; automated
   * activation awaits a defined manual-activation policy. */
  activation: ManualActivationOutcome;
}

export interface RejectSubscriptionRequestResponse {
  request: AdminSubscriptionRequestItem;
}

export type AiUsageTypeKey =
  | "AI_QUIZ_GENERATION"
  | "AI_ESSAY_GRADING"
  | "AI_CONTENT_GENERATION"
  | "AI_LESSON_SUMMARY"
  | "AI_QUESTION_EXPLANATION";

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
