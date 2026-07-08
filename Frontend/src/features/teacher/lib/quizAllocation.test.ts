import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import {
  allowedAllocationModes,
  buildAllocationFields,
  computeAllocationTotal,
  countAllocationBuckets,
  distributeEvenly,
  validateAllocation,
  type ChapterLessonsMap,
} from './quizAllocation';
import type { QuizGeneratorFormState } from '@/features/teacher/types/quizGeneration';

const CHAP_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const CHAP_B = 'bbbbbbbb-1111-4111-8111-111111111111';
const L_A1 = 'cccccccc-1111-4111-8111-111111111111';
const L_A2 = 'dddddddd-1111-4111-8111-111111111111';
const L_B1 = 'eeeeeeee-1111-4111-8111-111111111111';

const t = ((key: string) => key) as unknown as TFunction;

function form(overrides: Partial<QuizGeneratorFormState>): QuizGeneratorFormState {
  return {
    stageId: 'stage',
    chapterId: CHAP_A,
    sourceScope: 'SINGLE_CHAPTER',
    chapterIds: [],
    contentScope: 'CHAPTER',
    lessonIds: [],
    allocationMode: 'AUTO',
    chapterQuestionCounts: {},
    lessonQuestionCounts: {},
    title: '',
    questionCount: 10,
    timeLimit: 0,
    questionTypes: ['MCQ'],
    difficultyMode: 'uniform',
    difficulty: 'medium',
    mixedDifficulty: { easy: 33, medium: 34, hard: 33 },
    ...overrides,
  };
}

describe('distributeEvenly', () => {
  it('splits with largest-remainder to the earliest slots', () => {
    expect(distributeEvenly(10, 3)).toEqual([4, 3, 3]);
    expect(distributeEvenly(6, 3)).toEqual([2, 2, 2]);
    expect(distributeEvenly(2, 5)).toEqual([1, 1, 0, 0, 0]);
    expect(distributeEvenly(5, 0)).toEqual([]);
  });
});

describe('allowedAllocationModes', () => {
  it('offers modes appropriate to the source scope', () => {
    expect(allowedAllocationModes('SINGLE_CHAPTER')).toEqual(['AUTO', 'BY_LESSON']);
    expect(allowedAllocationModes('MULTI_CHAPTER')).toEqual(['AUTO', 'BY_CHAPTER', 'BY_LESSON']);
    expect(allowedAllocationModes('FULL_CURRICULUM')).toEqual(['AUTO']);
  });
});

describe('computeAllocationTotal', () => {
  const ctx: ChapterLessonsMap = { [CHAP_A]: [L_A1, L_A2], [CHAP_B]: [L_B1] };

  it('AUTO returns the plain question count', () => {
    expect(computeAllocationTotal(form({ allocationMode: 'AUTO', questionCount: 7 }), ctx)).toBe(7);
  });

  it('BY_CHAPTER sums per-chapter counts', () => {
    const f = form({
      sourceScope: 'MULTI_CHAPTER',
      allocationMode: 'BY_CHAPTER',
      chapterIds: [CHAP_A, CHAP_B],
      chapterQuestionCounts: { [CHAP_A]: 4, [CHAP_B]: 2 },
    });
    expect(computeAllocationTotal(f, ctx)).toBe(6);
  });

  it('BY_LESSON (single) sums lesson counts within the chapter', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      lessonQuestionCounts: { [L_A1]: 3, [L_A2]: 2 },
    });
    expect(computeAllocationTotal(f, ctx)).toBe(5);
  });

  it('BY_LESSON (multi) sums lesson counts across chapters', () => {
    const f = form({
      sourceScope: 'MULTI_CHAPTER',
      allocationMode: 'BY_LESSON',
      chapterIds: [CHAP_A, CHAP_B],
      lessonQuestionCounts: { [L_A1]: 1, [L_A2]: 2, [L_B1]: 3 },
    });
    expect(computeAllocationTotal(f, ctx)).toBe(6);
  });
});

describe('buildAllocationFields', () => {
  const ctx: ChapterLessonsMap = { [CHAP_A]: [L_A1, L_A2], [CHAP_B]: [L_B1] };

  it('AUTO produces no allocation fields (legacy body)', () => {
    expect(buildAllocationFields(form({ allocationMode: 'AUTO' }), ctx)).toEqual({});
  });

  it('BY_CHAPTER produces chapterAllocations', () => {
    const f = form({
      sourceScope: 'MULTI_CHAPTER',
      allocationMode: 'BY_CHAPTER',
      chapterIds: [CHAP_A, CHAP_B],
      chapterQuestionCounts: { [CHAP_A]: 4, [CHAP_B]: 2 },
    });
    expect(buildAllocationFields(f, ctx)).toEqual({
      allocationMode: 'BY_CHAPTER',
      chapterAllocations: [
        { chapterId: CHAP_A, questionCount: 4 },
        { chapterId: CHAP_B, questionCount: 2 },
      ],
    });
  });

  it('BY_LESSON (single) sets SELECTED_LESSONS + lessonAllocations for counted lessons', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      lessonQuestionCounts: { [L_A1]: 3, [L_A2]: 0 },
    });
    const fields = buildAllocationFields(f, ctx);
    expect(fields.allocationMode).toBe('BY_LESSON');
    expect(fields.contentScope).toBe('SELECTED_LESSONS');
    expect(fields.lessonIds).toEqual([L_A1]);
    expect(fields.lessonAllocations).toEqual([{ lessonId: L_A1, questionCount: 3 }]);
  });

  it('BY_LESSON (multi) nests lessonAllocations under each chapter', () => {
    const f = form({
      sourceScope: 'MULTI_CHAPTER',
      allocationMode: 'BY_LESSON',
      chapterIds: [CHAP_A, CHAP_B],
      lessonQuestionCounts: { [L_A1]: 2, [L_B1]: 3 },
    });
    expect(buildAllocationFields(f, ctx)).toEqual({
      allocationMode: 'BY_LESSON',
      chapterAllocations: [
        { chapterId: CHAP_A, lessonAllocations: [{ lessonId: L_A1, questionCount: 2 }] },
        { chapterId: CHAP_B, lessonAllocations: [{ lessonId: L_B1, questionCount: 3 }] },
      ],
    });
  });
});

describe('validateAllocation', () => {
  const ctx: ChapterLessonsMap = { [CHAP_A]: [L_A1, L_A2], [CHAP_B]: [L_B1] };

  it('AUTO is always valid', () => {
    expect(validateAllocation(form({ allocationMode: 'AUTO' }), ctx, t)).toEqual({});
  });

  it('flags a total that does not match the requested count', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      questionCount: 10,
      lessonQuestionCounts: { [L_A1]: 3, [L_A2]: 2 },
    });
    const errs = validateAllocation(f, ctx, t);
    expect(errs.allocationTotal).toBeTruthy();
  });

  it('accepts a matching total', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      questionCount: 5,
      lessonQuestionCounts: { [L_A1]: 3, [L_A2]: 2 },
    });
    expect(validateAllocation(f, ctx, t)).toEqual({});
  });

  it('requires at least one counted lesson (single chapter)', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      questionCount: 0,
      lessonQuestionCounts: {},
    });
    const errs = validateAllocation(f, ctx, t);
    expect(errs.allocation).toBeTruthy();
  });

  it('requires each selected chapter to have a counted lesson (multi)', () => {
    const f = form({
      sourceScope: 'MULTI_CHAPTER',
      allocationMode: 'BY_LESSON',
      chapterIds: [CHAP_A, CHAP_B],
      questionCount: 2,
      lessonQuestionCounts: { [L_A1]: 2 }, // CHAP_B has none
    });
    const errs = validateAllocation(f, ctx, t);
    expect(errs.allocation).toBeTruthy();
  });
});

describe('countAllocationBuckets', () => {
  const ctx: ChapterLessonsMap = { [CHAP_A]: [L_A1, L_A2] };
  it('counts one bucket per counted lesson', () => {
    const f = form({
      allocationMode: 'BY_LESSON',
      lessonQuestionCounts: { [L_A1]: 1, [L_A2]: 2 },
    });
    expect(countAllocationBuckets(f, ctx)).toBe(2);
  });
});
