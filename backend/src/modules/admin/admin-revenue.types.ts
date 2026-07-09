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
  /** Money students paid for this teacher's content (SUCCESS course payments). */
  courseRevenue: number;
  /** Platform revenue this teacher paid for their plan (SUCCESS subscription payments). */
  subscriptionRevenue: number;
  successfulCoursePayments: number;
}

export interface RevenueByChapterRow {
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string };
  confirmedRevenue: number;
  successfulPayments: number;
}

/** Safe course-payment DTO — never exposes paymobOrderId/paymobTransactionId/
 * rawCallback/errorMessage or any provider secret. */
export interface CoursePaymentDTO {
  id: string;
  student: { id: string; fullName: string; email: string };
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string } | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}
