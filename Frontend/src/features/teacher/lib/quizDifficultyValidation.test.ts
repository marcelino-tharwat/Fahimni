import { describe, it, expect, vi } from 'vitest';
import {
  getMixedDifficultyTotal,
  isMixedDistributionValid,
  mapFormDifficultyMode,
  validateQuizGeneratorDifficulty,
} from './quizDifficultyValidation';
import { buildGenerateQuizPayload } from './quizGeneratorPayload';

const t = vi.fn((key: string, opts?: Record<string, unknown>) => {
  if (opts?.total !== undefined) return `total:${opts.total}`;
  return key;
});

const baseForm = {
  stageId: 's',
  chapterId: '11111111-1111-4111-8111-111111111111',
  contentScope: 'CHAPTER' as const,
  lessonIds: [] as string[],
  title: '',
  questionCount: 10,
  timeLimit: 0,
  questionTypes: ['MCQ' as const],
  difficultyMode: 'uniform' as const,
  difficulty: 'hard' as const,
  mixedDifficulty: { easy: 33, medium: 34, hard: 33 },
};

describe('validateQuizGeneratorDifficulty', () => {
  it('requires a single difficulty in uniform mode', () => {
    const errors = validateQuizGeneratorDifficulty(
      { difficultyMode: 'uniform', difficulty: '', mixedDifficulty: baseForm.mixedDifficulty },
      t,
    );
    expect(errors.difficulty).toBe('teacher:quizGenerator.validationDifficulty');
  });

  it('does not require single difficulty in mixed mode', () => {
    const errors = validateQuizGeneratorDifficulty(
      { difficultyMode: 'mixed', difficulty: '', mixedDifficulty: { easy: 20, medium: 30, hard: 50 } },
      t,
    );
    expect(errors.difficulty).toBeUndefined();
    expect(errors.mixedDifficulty).toBeUndefined();
  });

  it('rejects mixed totals below 100', () => {
    const errors = validateQuizGeneratorDifficulty(
      { difficultyMode: 'mixed', difficulty: '', mixedDifficulty: { easy: 20, medium: 30, hard: 40 } },
      t,
    );
    expect(errors.mixedDifficulty).toBe('total:90');
  });
});

describe('buildGenerateQuizPayload difficulty modes', () => {
  it('sends SINGLE payload without distribution', () => {
    const payload = buildGenerateQuizPayload(baseForm);
    expect(payload).toEqual({
      chapterId: baseForm.chapterId,
      contentScope: 'CHAPTER',
      lessonIds: [],
      questionCount: 10,
      types: ['MCQ'],
      difficultyMode: 'SINGLE',
      difficulty: 'hard',
    });
    expect(payload).not.toHaveProperty('difficultyDistribution');
  });

  it('sends MIXED payload without single difficulty', () => {
    const payload = buildGenerateQuizPayload({
      ...baseForm,
      difficultyMode: 'mixed',
      difficulty: 'hard',
      mixedDifficulty: { easy: 20, medium: 30, hard: 50 },
    });
    expect(payload).toEqual({
      chapterId: baseForm.chapterId,
      contentScope: 'CHAPTER',
      lessonIds: [],
      questionCount: 10,
      types: ['MCQ'],
      difficultyMode: 'MIXED',
      difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
    });
    expect(payload).not.toHaveProperty('difficulty');
  });
});

describe('helpers', () => {
  it('maps uniform to SINGLE and mixed to MIXED', () => {
    expect(mapFormDifficultyMode('uniform')).toBe('SINGLE');
    expect(mapFormDifficultyMode('mixed')).toBe('MIXED');
  });

  it('validates mixed distribution totals', () => {
    expect(isMixedDistributionValid({ easy: 25, medium: 25, hard: 50 })).toBe(true);
    expect(getMixedDifficultyTotal({ easy: 25, medium: 25, hard: 50 })).toBe(100);
  });
});
