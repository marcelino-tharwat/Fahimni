import type {
  Status,
  BillingInterval,
  SubscriptionStatus,
  EnrollmentStatus,
  PaymentMethod,
  AiUsageType,
} from "../../generated/prisma/client.js";

const CURRENCY = "EGP";
export { CURRENCY };

export interface TeacherIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: Status;
  createdAt: string;
}

export interface TeacherProfileDetail {
  subject: string | null;
  bio: string | null;
  photoUrl: string | null;
}

export interface TeacherDetailStats {
  stagesCount: number;
  chaptersCount: number;
  lessonsCount: number;
  quizzesCount: number;
  studentsCount: number;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  pendingEnrollmentsCount: number;
  aiUsage: number;
}

export interface TeacherCurrentSubscription {
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: { code: string; name: string; displayName: string };
}

/** Safe subscription-payment projection — never provider ids / rawCallback / checkoutUrl. */
export interface SafeSubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  plan: { code: string; displayName: string };
}

export interface TeacherDetailRevenueSummary {
  confirmedCourseRevenue: number;
  monthlyConfirmedCourseRevenue: number;
  confirmedSubscriptionPayments: number;
  currency: string;
}

export interface AdminTeacherDetailResponse {
  teacher: TeacherIdentity;
  profile: TeacherProfileDetail;
  stats: TeacherDetailStats;
  currentSubscription: TeacherCurrentSubscription | null;
  pendingSubscriptionPayment: SafeSubscriptionPayment | null;
  revenue: TeacherDetailRevenueSummary;
}

// ── Students tab ────────────────────────────────────────────────────────────
/** A single enrollment scoped to the selected teacher's content. */
export interface TeacherScopedEnrollment {
  id: string;
  status: EnrollmentStatus;
  price: number;
  paymentMethod: PaymentMethod;
  enrolledAt: string;
  chapter: { id: string; name: string; stageId: string; stageName: string };
}

export interface TeacherStudentItem {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: Status;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  pendingEnrollmentsCount: number;
  /** ONLY this teacher's enrollments for the student (never other teachers'). */
  enrollments: TeacherScopedEnrollment[];
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

// ── Enrollments tab ──
export interface TeacherEnrollmentItem {
  id: string;
  status: EnrollmentStatus;
  price: number;
  paymentMethod: PaymentMethod;
  enrolledAt: string;
  student: { id: string; fullName: string; email: string | null };
  chapter: { id: string; name: string; stageId: string; stageName: string };
}

// ── Content tab ──
export interface ContentChapterNode {
  id: string;
  name: string;
  lessonsCount: number;
  quizzesCount: number;
}

export interface ContentStageNode {
  id: string;
  name: string;
  chaptersCount: number;
  chapters: ContentChapterNode[];
}

export interface TeacherContentResponse {
  counts: {
    stagesCount: number;
    chaptersCount: number;
    lessonsCount: number;
    quizzesCount: number;
    publishedQuizzesCount: number;
    draftQuizzesCount: number;
  };
  stages: ContentStageNode[];
}

// ── Revenue tab ──
/** Safe course-payment projection — never paymob ids / rawCallback. */
export interface SafeCoursePayment {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  student: { id: string; fullName: string };
  chapter: { id: string; name: string };
}

export interface TeacherRevenueResponse {
  currency: string;
  confirmedCourseRevenue: number;
  monthlyConfirmedCourseRevenue: number;
  coursePayments: {
    successCount: number;
    pendingCount: number;
    failedCount: number;
    recent: SafeCoursePayment[];
  };
  subscriptionPayments: {
    confirmedTotal: number;
    successCount: number;
    pendingCount: number;
    failedCount: number;
  };
}

// ── Subscription tab ──
export interface TeacherSubscriptionResponse {
  currentSubscription: TeacherCurrentSubscription | null;
  pendingPayment: SafeSubscriptionPayment | null;
  latestSuccessfulPayments: SafeSubscriptionPayment[];
  failedPaymentsCount: number;
}

// ── AI usage tab ──
export interface AiUsageByType {
  type: AiUsageType;
  events: number;
  units: number;
}

export interface TeacherAiUsageResponse {
  byType: AiUsageByType[];
  totalEvents: number;
  totalUnits: number;
  currentMonth: { events: number; units: number };
}
