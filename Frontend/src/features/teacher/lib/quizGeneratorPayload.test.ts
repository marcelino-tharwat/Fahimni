import { describe, it, expect } from 'vitest';
import {
  buildGenerateQuizPayload,
  clearLessonsOnChapterChange,
  clearLessonsOnScopeChange,
  isGenerateFormScopeValid,
  shouldShowLessonPicker,
} from './quizGeneratorPayload';

const CHAPTER = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const L2 = '33333333-3333-4333-8333-333333333333';

const baseForm = {
  chapterId: CHAPTER,
  contentScope: 'CHAPTER' as const,
  lessonIds: [] as string[],
  questionCount: 5,
  questionTypes: ['MCQ' as const],
  difficultyMode: 'uniform' as const,
  difficulty: 'medium' as const,
  mixedDifficulty: { easy: 33, medium: 34, hard: 33 },
};

describe('buildGenerateQuizPayload', () => {
  it('sends CHAPTER scope with empty lessonIds', () => {
    const payload = buildGenerateQuizPayload(baseForm);
    expect(payload).toEqual({
      chapterId: CHAPTER,
      contentScope: 'CHAPTER',
      lessonIds: [],
      questionCount: 5,
      types: ['MCQ'],
      difficultyMode: 'SINGLE',
      difficulty: 'medium',
    });
  });

  it('sends SELECTED_LESSONS with exact lessonIds', () => {
    const payload = buildGenerateQuizPayload({
      ...baseForm,
      contentScope: 'SELECTED_LESSONS',
      lessonIds: [L1],
    });
    expect(payload.contentScope).toBe('SELECTED_LESSONS');
    expect(payload.lessonIds).toEqual([L1]);
    expect(payload.chapterId).toBe(CHAPTER);
  });

  it('sends multi-lesson SELECTED_LESSONS payload', () => {
    const payload = buildGenerateQuizPayload({
      ...baseForm,
      contentScope: 'SELECTED_LESSONS',
      lessonIds: [L1, L2],
    });
    expect(payload.lessonIds).toEqual([L1, L2]);
  });

  it('sends MIXED mode without single difficulty', () => {
    const payload = buildGenerateQuizPayload({
      ...baseForm,
      difficultyMode: 'mixed',
      difficulty: 'hard',
      mixedDifficulty: { easy: 20, medium: 30, hard: 50 },
    });
    expect(payload).toEqual({
      chapterId: CHAPTER,
      contentScope: 'CHAPTER',
      lessonIds: [],
      questionCount: 5,
      types: ['MCQ'],
      difficultyMode: 'MIXED',
      difficultyDistribution: { easy: 20, medium: 30, hard: 50 },
    });
    expect(payload).not.toHaveProperty('difficulty');
  });

  it('does not include deprecated contradictory fields', () => {
    const payload = buildGenerateQuizPayload(baseForm) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('lessonId');
    expect(payload).not.toHaveProperty('selectedLessonIds');
  });

  it('strips stale lessonIds when scope is CHAPTER even if form still holds them', () => {
    const payload = buildGenerateQuizPayload({
      ...baseForm,
      lessonIds: [L1],
    });
    expect(payload.lessonIds).toEqual([]);
  });
});

describe('scope UI helpers', () => {
  it('shows lesson picker only for SELECTED_LESSONS', () => {
    expect(shouldShowLessonPicker('CHAPTER')).toBe(false);
    expect(shouldShowLessonPicker('SELECTED_LESSONS')).toBe(true);
  });

  it('clears lessons on chapter change', () => {
    expect(clearLessonsOnChapterChange()).toEqual([]);
  });

  it('clears lessons when switching to CHAPTER scope', () => {
    expect(clearLessonsOnScopeChange('CHAPTER', [L1, L2])).toEqual([]);
    expect(clearLessonsOnScopeChange('SELECTED_LESSONS', [L1])).toEqual([L1]);
  });

  it('blocks submission when SELECTED_LESSONS has no lessons', () => {
    expect(isGenerateFormScopeValid('SELECTED_LESSONS', [])).toBe(false);
    expect(isGenerateFormScopeValid('SELECTED_LESSONS', [L1])).toBe(true);
    expect(isGenerateFormScopeValid('CHAPTER', [])).toBe(true);
  });
});
