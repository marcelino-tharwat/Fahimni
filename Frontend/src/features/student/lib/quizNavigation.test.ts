import { describe, it, expect } from 'vitest';
import { resolveQuizStudentAction } from './quizNavigation';
import type { QuizItem } from '@/features/student/types/studentQuiz';

function quiz(overrides: Partial<QuizItem> = {}): QuizItem {
  return {
    id: 'q1',
    title: 'Quiz',
    questionCount: 5,
    points: 10,
    durationMinutes: 30,
    difficulty: 'medium',
    status: 'new',
    ...overrides,
  };
}

describe('resolveQuizStudentAction', () => {
  it('new quiz → start', () => {
    expect(resolveQuizStudentAction(quiz({ status: 'new' }))).toBe('start');
  });

  it('passed quiz → viewResult', () => {
    expect(
      resolveQuizStudentAction(
        quiz({ status: 'passed', attemptId: 'a1', score: 80 }),
      ),
    ).toBe('viewResult');
  });

  it('failed quiz → viewResult', () => {
    expect(
      resolveQuizStudentAction(
        quiz({ status: 'failed', attemptId: 'a1', score: 30, retakeAllowed: true }),
      ),
    ).toBe('viewResult');
  });

  it('pending + IN_PROGRESS → resume', () => {
    expect(
      resolveQuizStudentAction(
        quiz({
          status: 'pending',
          attemptId: 'a1',
          attemptStatus: 'IN_PROGRESS',
        }),
      ),
    ).toBe('resume');
  });

  it('pending + completed attempt → viewResult', () => {
    expect(
      resolveQuizStudentAction(
        quiz({
          status: 'pending',
          attemptId: 'a1',
          attemptStatus: 'COMPLETED',
        }),
      ),
    ).toBe('viewResult');
  });

  it('pending without attemptId → start', () => {
    expect(resolveQuizStudentAction(quiz({ status: 'pending' }))).toBe('start');
  });
});
