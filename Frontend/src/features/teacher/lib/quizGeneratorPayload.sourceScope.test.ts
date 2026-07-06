import { describe, it, expect } from 'vitest';
import {
  buildGenerateQuizPayload,
  isGenerateSourceScopeValid,
} from '@/features/teacher/lib/quizGeneratorPayload';
import type { QuizGeneratorFormState } from '@/features/teacher/types/quizGeneration';

const base: QuizGeneratorFormState = {
  stageId: 'stage-1',
  chapterId: 'ch-1',
  sourceScope: 'SINGLE_CHAPTER',
  chapterIds: [],
  contentScope: 'CHAPTER',
  lessonIds: [],
  title: '',
  questionCount: 5,
  timeLimit: 10,
  questionTypes: ['MCQ'],
  difficultyMode: 'uniform',
  difficulty: 'easy',
  mixedDifficulty: { easy: 33, medium: 34, hard: 33 },
};

describe('buildGenerateQuizPayload — source scope', () => {
  it('produces a legacy single-chapter payload (backward compatible)', () => {
    const p = buildGenerateQuizPayload(base);
    // sourceScope is intentionally omitted for single-chapter so the wire
    // payload stays identical to the legacy request.
    expect(p.sourceScope).toBeUndefined();
    expect(p.chapterId).toBe('ch-1');
    expect(p.contentScope).toBe('CHAPTER');
    expect(p.chapterIds).toBeUndefined();
    expect(p.difficultyMode).toBe('SINGLE');
  });

  it('keeps selected lessons for SINGLE_CHAPTER + SELECTED_LESSONS', () => {
    const p = buildGenerateQuizPayload({
      ...base,
      contentScope: 'SELECTED_LESSONS',
      lessonIds: ['l1', 'l2'],
    });
    expect(p.lessonIds).toEqual(['l1', 'l2']);
  });

  it('produces a MULTI_CHAPTER payload with chapterIds and no lessons', () => {
    const p = buildGenerateQuizPayload({
      ...base,
      sourceScope: 'MULTI_CHAPTER',
      chapterIds: ['ch-1', 'ch-2'],
    });
    expect(p.sourceScope).toBe('MULTI_CHAPTER');
    expect(p.chapterIds).toEqual(['ch-1', 'ch-2']);
    expect(p.contentScope).toBe('CHAPTER');
    expect(p.lessonIds).toEqual([]);
    expect(p.chapterId).toBeUndefined();
  });

  it('produces a FULL_CURRICULUM payload with stageId', () => {
    const p = buildGenerateQuizPayload({ ...base, sourceScope: 'FULL_CURRICULUM' });
    expect(p.sourceScope).toBe('FULL_CURRICULUM');
    expect(p.stageId).toBe('stage-1');
    expect(p.contentScope).toBe('CHAPTER');
  });

  it('carries a mixed difficulty distribution', () => {
    const p = buildGenerateQuizPayload({ ...base, difficultyMode: 'mixed' });
    expect(p.difficultyMode).toBe('MIXED');
    expect(p.difficultyDistribution).toEqual({ easy: 33, medium: 34, hard: 33 });
  });
});

describe('isGenerateSourceScopeValid', () => {
  it('requires a chapter for SINGLE_CHAPTER', () => {
    expect(isGenerateSourceScopeValid(base)).toBe(true);
    expect(isGenerateSourceScopeValid({ ...base, chapterId: '' })).toBe(false);
  });

  it('requires >= 2 chapters for MULTI_CHAPTER', () => {
    expect(
      isGenerateSourceScopeValid({ ...base, sourceScope: 'MULTI_CHAPTER', chapterIds: ['a'] }),
    ).toBe(false);
    expect(
      isGenerateSourceScopeValid({ ...base, sourceScope: 'MULTI_CHAPTER', chapterIds: ['a', 'b'] }),
    ).toBe(true);
  });

  it('requires a stage for FULL_CURRICULUM', () => {
    expect(isGenerateSourceScopeValid({ ...base, sourceScope: 'FULL_CURRICULUM' })).toBe(true);
    expect(
      isGenerateSourceScopeValid({ ...base, sourceScope: 'FULL_CURRICULUM', stageId: '' }),
    ).toBe(false);
  });
});
