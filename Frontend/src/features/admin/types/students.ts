export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type EnrollmentStatus = 'ACTIVE' | 'DEACTIVATED' | 'PAYMENT_PENDING';
export type PaymentMethod = 'FREE' | 'PROMO' | 'PAYMOB';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export type StudentFilter =
  | 'all'
  | 'active'
  | 'without_enrollment'
  | 'without_active_teacher'
  | 'payment_pending';

export interface StudentTeacherRef {
  id: string;
  fullName: string;
  subject: string | null;
}

export interface AdminStudentListItem {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: StudentStatus;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  pendingEnrollmentsCount: number;
  teachersCount: number;
  pendingPaymentsCount: number;
  teachers: StudentTeacherRef[];
  latestEnrollmentAt: string | null;
  createdAt: string;
}

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

export interface AdminStudentsQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: StudentStatus;
  filter?: StudentFilter;
  sortBy?: 'createdAt' | 'fullName' | 'email' | 'status';
  sort?: 'asc' | 'desc';
}

export interface StudentIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: StudentStatus;
  createdAt: string;
}

export interface StudentSummary {
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  pendingEnrollmentsCount: number;
  teachersCount: number;
  quizAttemptsCount: number;
  averageScore: number;
  completedLessonsCount: number;
  confirmedPayments: number;
  pendingPayments: number;
  failedPayments: number;
}

export interface AdminStudentDetail {
  student: StudentIdentity;
  summary: StudentSummary;
  teachers: StudentTeacherRef[];
}

export interface StudentEnrollmentItem {
  id: string;
  status: EnrollmentStatus;
  price: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  enrolledAt: string;
  chapter: { id: string; name: string };
  stage: { id: string; name: string };
  teacher: { id: string; fullName: string; subject: string | null };
}

export interface StudentPaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string };
}
export interface StudentPayments {
  data: StudentPaymentItem[];
  summary: { confirmed: number; pending: number; failed: number; confirmedTotal: number; currency: string };
}

export interface StudentLearningSummary {
  quizAttemptsCount: number;
  completedQuizAttemptsCount: number;
  averageScore: number;
  lessonProgressCount: number;
  completedLessonsCount: number;
  lastActivityAt: string | null;
}
