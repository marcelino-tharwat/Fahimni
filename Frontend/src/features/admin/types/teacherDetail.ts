import type {
  BillingInterval,
  SubscriptionStatus,
  TeacherCurrentSubscription,
  TeacherStatus,
} from '@/features/admin/types/teachers';

export type { BillingInterval, SubscriptionStatus, TeacherCurrentSubscription, TeacherStatus };

export type EnrollmentStatus = 'ACTIVE' | 'DEACTIVATED' | 'PAYMENT_PENDING';
export type PaymentMethod = 'FREE' | 'PROMO' | 'PAYMOB';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type AiUsageType =
  | 'AI_QUIZ_GENERATION'
  | 'AI_ESSAY_GRADING'
  | 'AI_CONTENT_GENERATION'
  | 'AI_LESSON_SUMMARY'
  | 'AI_QUESTION_EXPLANATION';

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

export interface TeacherIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  status: TeacherStatus;
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

export interface SafeSubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  status: PaymentStatus;
  createdAt: string;
  plan: { code: string; displayName: string };
}

export interface TeacherDetailRevenueSummary {
  confirmedCourseRevenue: number;
  monthlyConfirmedCourseRevenue: number;
  confirmedSubscriptionPayments: number;
  currency: string;
}

export interface AdminTeacherDetail {
  teacher: TeacherIdentity;
  profile: TeacherProfileDetail;
  stats: TeacherDetailStats;
  currentSubscription: TeacherCurrentSubscription | null;
  pendingSubscriptionPayment: SafeSubscriptionPayment | null;
  revenue: TeacherDetailRevenueSummary;
}

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
  status: TeacherStatus;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  pendingEnrollmentsCount: number;
  enrollments: TeacherScopedEnrollment[];
}

export interface TeacherEnrollmentItem {
  id: string;
  status: EnrollmentStatus;
  price: number;
  paymentMethod: PaymentMethod;
  enrolledAt: string;
  student: { id: string; fullName: string; email: string | null };
  chapter: { id: string; name: string; stageId: string; stageName: string };
}

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
export interface TeacherContent {
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

export interface SafeCoursePayment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  student: { id: string; fullName: string };
  chapter: { id: string; name: string };
}

export interface TeacherRevenue {
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

export interface TeacherSubscription {
  currentSubscription: TeacherCurrentSubscription | null;
  pendingPayment: SafeSubscriptionPayment | null;
  latestSuccessfulPayments: SafeSubscriptionPayment[];
  failedPaymentsCount: number;
}

export interface AiUsageByType {
  type: AiUsageType;
  events: number;
  units: number;
}
export interface TeacherAiUsage {
  byType: AiUsageByType[];
  totalEvents: number;
  totalUnits: number;
  currentMonth: { events: number; units: number };
}
