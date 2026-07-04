/**
 * Types for the aggregated student profile overview returned by
 * `GET /api/students/me/profile`. Dates arrive as ISO strings over the wire.
 * These mirror the backend `StudentProfileOverviewDTO` exactly.
 */

export type StudentRole = 'STUDENT' | 'OPERATION' | 'ADMIN';
export type StudentAccountStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type EnrollmentPlanType = 'FREE' | 'PROMO' | 'PAYMOB';
export type EnrollmentStatus = 'ACTIVE' | 'DEACTIVATED' | 'PAYMENT_PENDING';

export type AchievementId =
  | 'first_lesson'
  | 'ten_lessons'
  | 'first_quiz'
  | 'twenty_five_lessons'
  | 'perfect_score';

export interface StudentProfileIdentity {
  id: string;
  fullName: string;
  avatarInitial: string;
  role: StudentRole;
  status: StudentAccountStatus;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  stageName: string | null;
}

export interface StudentAcademicProgress {
  completedLessons: number;
  totalLessons: number;
  completedQuizzes: number;
  averageGrade: number | null;
  overallProgressPercent: number;
}

export interface StudentCourseSummary {
  id: string;
  title: string;
  subtitle: string | null;
  status: EnrollmentStatus;
  planType: EnrollmentPlanType;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

export interface StudentSubscriptionSummary {
  id: string;
  title: string;
  status: EnrollmentStatus;
  planType: EnrollmentPlanType;
  price: number;
  startedAt: string;
}

export interface StudentAchievement {
  id: AchievementId;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface StudentProfileResponse {
  student: StudentProfileIdentity;
  academicProgress: StudentAcademicProgress;
  courses: StudentCourseSummary[];
  subscriptions: StudentSubscriptionSummary[];
  achievements: StudentAchievement[];
}
