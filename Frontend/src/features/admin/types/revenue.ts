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

export interface RevenueSummary {
  confirmedCourseRevenue: number;
  confirmedTeacherSubscriptionRevenue: number;
  totalConfirmedRevenue: number;
  monthlyConfirmedRevenue: number;
  freeTeachersCount: number;
  paidTeachersCount: number;
  pendingCoursePayments: number;
  failedCoursePayments: number;
  pendingSubscriptionPayments: number;
  failedSubscriptionPayments: number;
  currency: string;
  reliabilityWarnings: string[];
}

export interface RevenueByTeacherRow {
  teacher: { id: string; fullName: string };
  courseRevenue: number;
  subscriptionRevenue: number;
  successfulCoursePayments: number;
}

export interface RevenueByChapterRow {
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string };
  confirmedRevenue: number;
  successfulPayments: number;
}

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface CoursePaymentDTO {
  id: string;
  student: { id: string; fullName: string; email: string };
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string } | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface SubscriptionPaymentDTO {
  id: string;
  teacher: { id: string; fullName: string; email: string };
  plan: { id: string; code: string; displayName: string };
  amount: number;
  currency: string;
  billingInterval: string;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentsQuery {
  q?: string;
  status?: PaymentStatus;
  teacherId?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
