import { describe, it, expect, vi } from 'vitest';
import { resolveLessonLockMessage } from './lessonAccessErrors';

const t = vi.fn((key: string) => key);

describe('resolveLessonLockMessage', () => {
  it('maps previous lesson lock reason', () => {
    expect(resolveLessonLockMessage('PREVIOUS_LESSON_NOT_COMPLETED', t)).toBe(
      'student:lesson.lock.previousLesson',
    );
  });

  it('maps required quiz lock reason', () => {
    expect(resolveLessonLockMessage('REQUIRED_QUIZ_NOT_COMPLETED', t)).toBe(
      'student:lesson.lock.requiredQuiz',
    );
  });

  it('falls back for unknown reason', () => {
    expect(resolveLessonLockMessage(null, t)).toBe('student:lesson.lock.unavailable');
  });
});
