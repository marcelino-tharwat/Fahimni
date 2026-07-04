import type {
  AchievementId,
  EnrollmentPlanType,
  StudentAccountStatus,
  StudentRole,
} from '@/features/student/types/studentProfile';

/**
 * Pure presentation helpers for the Student Profile page. All display values
 * are derived from the backend response here (no hardcoded stats); the visual
 * identity (emoji/colour per achievement) lives in this map so the page markup
 * stays declarative and the mapping is unit-testable.
 */

export interface AchievementMeta {
  emoji: string;
  /** Tailwind background utility for the badge circle. */
  color: string;
  /** i18n key under the `profile.*` namespace. */
  nameKey: string;
}

/** Fixed display order + visual identity, keyed by the backend achievement id. */
export const ACHIEVEMENT_META: Record<AchievementId, AchievementMeta> = {
  first_lesson: { emoji: '📖', color: 'bg-warning-500', nameKey: 'firstLesson' },
  ten_lessons: { emoji: '📚', color: 'bg-cyan-500', nameKey: 'tenLessons' },
  first_quiz: { emoji: '✍️', color: 'bg-purple-500', nameKey: 'firstQuiz' },
  twenty_five_lessons: { emoji: '📚', color: 'bg-success-500', nameKey: 'twentyFiveLessons' },
  perfect_score: { emoji: '🏆', color: 'bg-warning-500', nameKey: 'perfectScore' },
};

/** i18n key (under `profile.*`) for the student's role label. */
export function roleLabelKey(role: StudentRole): string {
  switch (role) {
    case 'OPERATION':
      return 'roleTeacher';
    case 'ADMIN':
      return 'roleAdmin';
    case 'STUDENT':
    default:
      return 'student';
  }
}

export interface StatusMeta {
  /** i18n key under `profile.*`. */
  labelKey: string;
  /** Drives the badge colour + dot; only ACTIVE reads as "on". */
  active: boolean;
}

export function statusMeta(status: StudentAccountStatus): StatusMeta {
  if (status === 'ACTIVE') {
    return { labelKey: 'active', active: true };
  }
  if (status === 'BANNED') {
    return { labelKey: 'banned', active: false };
  }
  return { labelKey: 'inactive', active: false };
}

/** i18n key (under `profile.paymentMethod.*`) for an enrollment plan type. */
export function planTypeKey(plan: EnrollmentPlanType): EnrollmentPlanType {
  return plan;
}

/** Clamp a percentage into the 0-100 range for progress bars. */
export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Format the average grade for display. Null (no scored quizzes yet) renders as
 * an em dash per the design convention; a number renders as a percent value.
 */
export function formatAverageGrade(averageGrade: number | null): string {
  if (averageGrade === null || averageGrade === undefined) return '—';
  return `${clampPercent(averageGrade)}`;
}
