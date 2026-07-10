import type { Status, BillingInterval, SubscriptionStatus } from "../../generated/prisma/client.js";

/**
 * Per-teacher aggregated metrics. Two revenue values are surfaced SEPARATELY and
 * must never be summed into one figure:
 *  - confirmedCourseRevenue          → money students paid for THIS teacher's
 *    course content (SUCCESS PaymentTransaction through chapter → chapter.teacherId).
 *  - confirmedSubscriptionPayments   → money THIS teacher paid the PLATFORM for a
 *    plan (SUCCESS TeacherSubscriptionPayment.teacherId). Platform revenue, a cost
 *    to the teacher — deliberately kept distinct from course revenue.
 */
export interface TeacherStats {
  stagesCount: number;
  chaptersCount: number;
  lessonsCount: number;
  quizzesCount: number;
  studentsCount: number;
  enrollmentsCount: number;
  confirmedCourseRevenue: number;
  confirmedSubscriptionPayments: number;
  monthlyConfirmedCourseRevenue: number;
  aiUsage: number;
}

export interface TeacherProfileSummary {
  subject: string | null;
  photoUrl: string | null;
}

/** Current active/trialing subscription, resolved to safe plan display fields. */
export interface TeacherCurrentSubscription {
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodEnd: string;
  plan: {
    code: string;
    name: string;
    displayName: string;
  };
}

/**
 * Latest PENDING subscription payment (safe projection only). Never exposes
 * rawCallback / providerOrderId / providerTransactionId / checkoutUrl.
 */
export interface TeacherPendingSubscriptionPayment {
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  createdAt: string;
  plan: {
    code: string;
    displayName: string;
  };
}

export interface AdminTeacherListItem {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: Status;
  profile: TeacherProfileSummary;
  stats: TeacherStats;
  currentSubscription: TeacherCurrentSubscription | null;
  pendingSubscriptionPayment: TeacherPendingSubscriptionPayment | null;
  createdAt: string;
}

export interface AdminTeachersListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTeachersListResponse {
  data: AdminTeacherListItem[];
  meta: AdminTeachersListMeta;
}
