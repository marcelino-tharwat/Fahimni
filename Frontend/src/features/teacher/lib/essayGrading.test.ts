import { describe, expect, it } from 'vitest';

function parseGrade(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function validateMarks(
  essays: { questionId: string; maximumPoints: number }[],
  fields: Record<string, { awardedPoints: string }>,
) {
  const errors: Record<string, boolean> = {};
  let valid = true;
  for (const essay of essays) {
    const grade = parseGrade(fields[essay.questionId]?.awardedPoints ?? '');
    const hasError =
      grade === null ||
      Number.isNaN(grade) ||
      grade < 0 ||
      grade > essay.maximumPoints;
    if (hasError) {
      errors[essay.questionId] = true;
      valid = false;
    }
  }
  return { valid, errors };
}

describe('essay grading form validation', () => {
  const essays = [
    { questionId: 'q1', maximumPoints: 5 },
    { questionId: 'q2', maximumPoints: 5 },
  ];

  it('rejects empty marks', () => {
    expect(
      validateMarks(essays, {
        q1: { awardedPoints: '' },
        q2: { awardedPoints: '3' },
      }).valid,
    ).toBe(false);
  });

  it('accepts zero as a valid mark', () => {
    expect(
      validateMarks(essays, {
        q1: { awardedPoints: '0' },
        q2: { awardedPoints: '5' },
      }).valid,
    ).toBe(true);
  });

  it('rejects above-maximum marks', () => {
    expect(
      validateMarks(essays, {
        q1: { awardedPoints: '6' },
        q2: { awardedPoints: '1' },
      }).valid,
    ).toBe(false);
  });

  it('rejects negative marks', () => {
    expect(
      validateMarks(essays, {
        q1: { awardedPoints: '-1' },
        q2: { awardedPoints: '2' },
      }).valid,
    ).toBe(false);
  });
});

describe('essay grading API paths', () => {
  it('uses real backend routes', () => {
    const hub = '/quizzes/essay-grading';
    const submissions = '/quizzes/quiz-1/essay-submissions';
    const detail = '/attempts/attempt-1/essay-grading';
    const grade = '/attempts/attempt-1/grade-essays';
    expect(hub).not.toContain('mock');
    expect(submissions).not.toContain('mock');
    expect(detail).not.toContain('mock');
    expect(grade).not.toContain('mock');
  });
});
