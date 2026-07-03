import type { ApiError } from '@/shared/lib/api/client';

export interface QuizAccessErrorView {
  titleKey: string;
  messageKey: string;
  /** Navigate to results when attempt was already submitted/finalized. */
  attemptId?: string;
  /** Show browse-courses CTA vs back-to-quizzes. */
  primaryAction: 'browseCourses' | 'viewQuizzes' | 'viewResults';
}

const CODE_TO_VIEW: Record<string, Omit<QuizAccessErrorView, 'attemptId'>> = {
  QUIZ_NOT_FOUND: {
    titleKey: 'quiz:access.notFoundTitle',
    messageKey: 'quiz:access.notFoundMsg',
    primaryAction: 'viewQuizzes',
  },
  QUIZ_NOT_PUBLISHED: {
    titleKey: 'quiz:access.notPublishedTitle',
    messageKey: 'quiz:access.notPublishedMsg',
    primaryAction: 'viewQuizzes',
  },
  QUIZ_NOT_STARTED: {
    titleKey: 'quiz:access.notStartedTitle',
    messageKey: 'quiz:access.notStartedMsg',
    primaryAction: 'viewQuizzes',
  },
  QUIZ_CLOSED: {
    titleKey: 'quiz:access.closedTitle',
    messageKey: 'quiz:access.closedMsg',
    primaryAction: 'viewQuizzes',
  },
  QUIZ_PARENT_UNAVAILABLE: {
    titleKey: 'quiz:access.parentUnavailableTitle',
    messageKey: 'quiz:access.parentUnavailableMsg',
    primaryAction: 'browseCourses',
  },
  ENROLLMENT_REQUIRED: {
    titleKey: 'quiz:access.enrollmentRequiredTitle',
    messageKey: 'quiz:access.enrollmentRequiredMsg',
    primaryAction: 'browseCourses',
  },
  ENROLLMENT_INACTIVE: {
    titleKey: 'quiz:access.enrollmentInactiveTitle',
    messageKey: 'quiz:access.enrollmentInactiveMsg',
    primaryAction: 'browseCourses',
  },
  ATTEMPT_LIMIT_REACHED: {
    titleKey: 'quiz:access.attemptLimitTitle',
    messageKey: 'quiz:access.attemptLimitMsg',
    primaryAction: 'viewQuizzes',
  },
  ATTEMPT_ALREADY_SUBMITTED: {
    titleKey: 'quiz:access.alreadySubmittedTitle',
    messageKey: 'quiz:access.alreadySubmittedMsg',
    primaryAction: 'viewResults',
  },
  ATTEMPT_EXPIRED: {
    titleKey: 'quiz:access.attemptExpiredTitle',
    messageKey: 'quiz:access.attemptExpiredMsg',
    primaryAction: 'viewResults',
  },
  QUIZ_DURATION_NOT_CONFIGURED: {
    titleKey: 'quiz:access.durationNotConfiguredTitle',
    messageKey: 'quiz:access.durationNotConfiguredMsg',
    primaryAction: 'viewQuizzes',
  },
  QUIZ_PREREQUISITE_LESSON_INCOMPLETE: {
    titleKey: 'quiz:access.prerequisiteLessonTitle',
    messageKey: 'quiz:access.prerequisiteLessonMsg',
    primaryAction: 'browseCourses',
  },
  QUIZ_NO_QUESTIONS: {
    titleKey: 'quiz:access.noQuestionsTitle',
    messageKey: 'quiz:access.noQuestionsMsg',
    primaryAction: 'viewQuizzes',
  },
};

const GENERIC_FALLBACK: Omit<QuizAccessErrorView, 'attemptId'> = {
  titleKey: 'quiz:err403Title',
  messageKey: 'quiz:err403Msg',
  primaryAction: 'browseCourses',
};

export function resolveQuizAccessError(err: ApiError): QuizAccessErrorView {
  const code = err.code;
  const attemptId =
    typeof (err as ApiError & { attemptId?: string }).attemptId === 'string'
      ? (err as ApiError & { attemptId?: string }).attemptId
      : undefined;

  if (code === 'ATTEMPT_ALREADY_SUBMITTED' && attemptId) {
    return {
      ...CODE_TO_VIEW.ATTEMPT_ALREADY_SUBMITTED,
      attemptId,
    };
  }

  if (code && CODE_TO_VIEW[code]) {
    return { ...CODE_TO_VIEW[code], ...(attemptId ? { attemptId } : {}) };
  }

  if (err.statusCode === 409) {
    return {
      ...CODE_TO_VIEW.ATTEMPT_ALREADY_SUBMITTED,
      ...(attemptId ? { attemptId } : {}),
    };
  }

  return { ...GENERIC_FALLBACK };
}
