export type TeacherStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

/**
 * Per-teacher metrics. `confirmedCourseRevenue` (money students paid for this
 * teacher's content) and `confirmedSubscriptionPayments` (money the teacher paid
 * the platform for a plan) are DISTINCT values — never summed into one figure.
 */
export interface AdminTeacherStats {
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

export interface TeacherCurrentSubscription {
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodEnd: string;
  plan: { code: string; name: string; displayName: string };
}

export interface TeacherPendingSubscriptionPayment {
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  createdAt: string;
  plan: { code: string; displayName: string };
}

export interface AdminTeacher {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: TeacherStatus;
  profile: TeacherProfileSummary;
  stats: AdminTeacherStats;
  currentSubscription: TeacherCurrentSubscription | null;
  pendingSubscriptionPayment: TeacherPendingSubscriptionPayment | null;
  createdAt: string;
}

export interface AdminTeachersMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTeachersResponse {
  data: AdminTeacher[];
  meta: AdminTeachersMeta;
}

export interface AdminTeachersQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: TeacherStatus;
  sortBy?: 'createdAt' | 'fullName' | 'email' | 'status';
  sort?: 'asc' | 'desc';
}
