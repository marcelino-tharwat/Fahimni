import { describe, it, expect } from 'vitest';
import { resolveQuizAccessError } from './quizAccessErrors';
import type { ApiError } from '@/shared/lib/api/client';

function err(partial: Partial<ApiError> & Pick<ApiError, 'statusCode'>): ApiError {
  return { message: 'x', ...partial };
}

describe('resolveQuizAccessError', () => {
  it('maps ENROLLMENT_REQUIRED to enrollment copy', () => {
    const view = resolveQuizAccessError(
      err({ statusCode: 403, code: 'ENROLLMENT_REQUIRED' }),
    );
    expect(view.titleKey).toBe('quiz:access.enrollmentRequiredTitle');
    expect(view.messageKey).toBe('quiz:access.enrollmentRequiredMsg');
    expect(view.primaryAction).toBe('browseCourses');
  });

  it('maps QUIZ_DURATION_NOT_CONFIGURED', () => {
    const view = resolveQuizAccessError(
      err({ statusCode: 400, code: 'QUIZ_DURATION_NOT_CONFIGURED' }),
    );
    expect(view.titleKey).toBe('quiz:access.durationNotConfiguredTitle');
    expect(view.primaryAction).toBe('viewQuizzes');
  });

  it('maps ATTEMPT_ALREADY_SUBMITTED with attemptId for results navigation', () => {
    const view = resolveQuizAccessError(
      err({
        statusCode: 409,
        code: 'ATTEMPT_ALREADY_SUBMITTED',
        attemptId: 'attempt-1',
      }),
    );
    expect(view.attemptId).toBe('attempt-1');
    expect(view.primaryAction).toBe('viewResults');
  });

  it('uses generic fallback for unknown codes', () => {
    const view = resolveQuizAccessError(err({ statusCode: 500 }));
    expect(view.titleKey).toBe('quiz:err403Title');
    expect(view.messageKey).toBe('quiz:err403Msg');
  });

  it('maps QUIZ_NOT_PUBLISHED', () => {
    const view = resolveQuizAccessError(
      err({ statusCode: 403, code: 'QUIZ_NOT_PUBLISHED' }),
    );
    expect(view.titleKey).toBe('quiz:access.notPublishedTitle');
  });
});
