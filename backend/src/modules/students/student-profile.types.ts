import type {
  Role,
  Status,
  EnrollmentStatus,
  PaymentMethod,
} from "../../generated/prisma/client.js";

/**
 * Achievement identifiers derived dynamically from a student's real progress
 * and quiz data. No achievement table exists in the schema, so these are
 * computed on read (see student-profile.service) and never persisted.
 */
export type AchievementId =
  | "first_lesson"
  | "ten_lessons"
  | "first_quiz"
  | "twenty_five_lessons"
  | "perfect_score";

export const ACHIEVEMENT_IDS: readonly AchievementId[] = [
  "first_lesson",
  "ten_lessons",
  "first_quiz",
  "twenty_five_lessons",
  "perfect_score",
] as const;

export interface ProfileIdentityDTO {
  id: string;
  fullName: string;
  /** First visible character of the name (falls back to email initial, then '?'). */
  avatarInitial: string;
  role: Role;
  status: Status;
  email: string | null;
  /** User.mobile — the schema has no separate phone field. */
  phone: string | null;
  /** User.createdAt — account creation is the product's "joined" date. */
  joinedAt: Date;
  /** Active enrollment stage via StudentProfile.stageId; null if no profile. */
  stageName: string | null;
}

export interface AcademicProgressDTO {
  /** Distinct completed LessonProgress rows among accessible lessons. */
  completedLessons: number;
  /** Non-deleted lessons in the student's accessible (free + enrolled) chapters. */
  totalLessons: number;
  /** Submitted quiz attempts (COMPLETED or GRADED); one attempt per quiz. */
  completedQuizzes: number;
  /** Mean of GRADED scored attempts as a 0-100 percent, rounded; null if none. */
  averageGrade: number | null;
  /** completedLessons / totalLessons * 100, rounded; 0 when no accessible lessons. */
  overallProgressPercent: number;
}

export interface ProfileCourseDTO {
  id: string;
  title: string;
  /** Parent stage name (subtitle in the UI). */
  subtitle: string | null;
  status: EnrollmentStatus;
  planType: PaymentMethod;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

export interface ProfileSubscriptionDTO {
  id: string;
  title: string;
  status: EnrollmentStatus;
  planType: PaymentMethod;
  price: number;
  startedAt: Date;
}

export interface ProfileAchievementDTO {
  id: AchievementId;
  unlocked: boolean;
  /** Completion timestamp that unlocked it, or null when locked/unknown. */
  unlockedAt: Date | null;
}

export interface StudentProfileOverviewDTO {
  student: ProfileIdentityDTO;
  academicProgress: AcademicProgressDTO;
  courses: ProfileCourseDTO[];
  subscriptions: ProfileSubscriptionDTO[];
  achievements: ProfileAchievementDTO[];
}
