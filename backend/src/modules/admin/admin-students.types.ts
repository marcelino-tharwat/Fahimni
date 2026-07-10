import type {
  Status,
  EnrollmentStatus,
  PaymentMethod,
} from "../../generated/prisma/client.js";

export const CURRENCY = "EGP";

export type StudentFilter =
  | "all"
  | "active"
  | "without_enrollment"
  | "without_active_teacher"
  | "payment_pending";

/** Distinct teacher a student is connected to (through enrollment → chapter.teacher). */
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
  status: Status;
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

// ── Detail ──
export interface StudentIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: Status;
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

export interface AdminStudentDetailResponse {
  student: StudentIdentity;
  summary: StudentSummary;
  teachers: StudentTeacherRef[];
}

// ── Enrollments ──
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

// ── Payments (safe course payment projection) ──
export interface StudentPaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  chapter: { id: string; name: string };
  teacher: { id: string; fullName: string };
}

export interface StudentPaymentsResponse {
  data: StudentPaymentItem[];
  summary: { confirmed: number; pending: number; failed: number; confirmedTotal: number; currency: string };
}

// ── Learning summary ──
export interface StudentLearningSummary {
  quizAttemptsCount: number;
  completedQuizAttemptsCount: number;
  averageScore: number;
  lessonProgressCount: number;
  completedLessonsCount: number;
  lastActivityAt: string | null;
}
