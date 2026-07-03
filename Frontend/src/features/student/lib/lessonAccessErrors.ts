import type { TFunction } from 'i18next';

export type LessonLockReason =
  | 'ENROLLMENT_REQUIRED'
  | 'PREVIOUS_LESSON_NOT_COMPLETED'
  | 'REQUIRED_QUIZ_NOT_COMPLETED'
  | 'REQUIRED_QUIZ_NOT_PASSED'
  | 'REQUIRED_QUIZ_AWAITING_GRADING'
  | 'ATTEMPT_LIMIT_REACHED'
  | 'LESSON_UNAVAILABLE';

const LOCK_REASON_KEYS: Record<LessonLockReason, string> = {
  ENROLLMENT_REQUIRED: 'student:lesson.lock.enrollmentRequired',
  PREVIOUS_LESSON_NOT_COMPLETED: 'student:lesson.lock.previousLesson',
  REQUIRED_QUIZ_NOT_COMPLETED: 'student:lesson.lock.requiredQuiz',
  REQUIRED_QUIZ_NOT_PASSED: 'student:lesson.lock.requiredQuizPass',
  REQUIRED_QUIZ_AWAITING_GRADING: 'student:lesson.lock.awaitingGrading',
  ATTEMPT_LIMIT_REACHED: 'student:lesson.lock.attemptLimit',
  LESSON_UNAVAILABLE: 'student:lesson.lock.unavailable',
};

export function resolveLessonLockMessage(
  lockReason: LessonLockReason | null | undefined,
  t: TFunction,
): string {
  if (!lockReason) {
    return t('student:lesson.lock.unavailable');
  }
  const key = LOCK_REASON_KEYS[lockReason] ?? LOCK_REASON_KEYS.LESSON_UNAVAILABLE;
  return t(key);
}
