import { describe, it, expect } from 'vitest';
import { resolveResultTone, summarizeQuizResults } from './quizResultStats';
import type { QuestionResult } from '@/features/student/types/quizResults';

function result(
  status: QuestionResult['status'],
  awardedPoints: number | null = null,
): QuestionResult {
  return {
    question: { id: 'q1', type: 'mcq', text: 'Q', points: 2 },
    studentAnswer: 'a',
    status,
    awardedPoints,
    maxPoints: 2,
  };
}

describe('resolveResultTone', () => {
  it('pending essay stays pending', () => {
    expect(resolveResultTone(result('pending', null))).toBe('pending');
  });

  it('graded essay with points counts as correct', () => {
    expect(resolveResultTone(result('graded', 4))).toBe('correct');
  });

  it('graded essay with zero points counts as incorrect', () => {
    expect(resolveResultTone(result('graded', 0))).toBe('incorrect');
  });
});

describe('summarizeQuizResults', () => {
  it('does not count graded essays as pending', () => {
    const summary = summarizeQuizResults([
      result('correct', 2),
      result('incorrect', 0),
      result('graded', 3),
    ]);

    expect(summary).toEqual({
      correctCount: 2,
      wrongCount: 1,
      pendingCount: 0,
    });
  });

  it('counts only pending essays in pending bucket', () => {
    const summary = summarizeQuizResults([
      result('correct', 2),
      result('pending', null),
    ]);

    expect(summary).toEqual({
      correctCount: 1,
      wrongCount: 0,
      pendingCount: 1,
    });
  });
});
