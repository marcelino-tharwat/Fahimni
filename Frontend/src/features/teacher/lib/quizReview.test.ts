import { describe, it, expect } from 'vitest';
import {
  blankDraft,
  buildMetadataMap,
  draftToApiPayload,
  mergeMetadata,
  normalizeOptions,
  optionLabel,
  optionsToRecord,
  questionToDraft,
  reorderIds,
  sortQuestions,
  sumQuestionPoints,
  toReviewQuestion,
  typeBadge,
  validatePoints,
  validateQuestionDraft,
  type ReviewQuestion,
} from './quizReview';

describe('normalizeOptions', () => {
  it('handles an array (generated questions)', () => {
    expect(normalizeOptions(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  });
  it('handles a record map (manual questions)', () => {
    expect(normalizeOptions({ '1': 'a', '2': 'b' })).toEqual(['a', 'b']);
  });
  it('returns [] for null/undefined and drops empties', () => {
    expect(normalizeOptions(null)).toEqual([]);
    expect(normalizeOptions(['a', '', 'b'])).toEqual(['a', 'b']);
  });
});

describe('toReviewQuestion', () => {
  it('maps a raw MCQ and defaults points to 1 when absent', () => {
    const q = toReviewQuestion({ id: 'q1', quizId: 'z', type: 'MCQ', content: 'C', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a', sortOrder: 2 });
    expect(q).toMatchObject({ id: 'q1', type: 'MCQ', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a', sortOrder: 2, points: 1 });
  });
  it('does not invent an essay answer (null stays null, no options)', () => {
    const q = toReviewQuestion({ id: 'e', quizId: 'z', type: 'ESSAY', content: 'Explain', correctAnswer: null });
    expect(q.correctAnswer).toBeNull();
    expect(q.options).toEqual([]);
  });
  it('coerces an unknown type to ESSAY (never crashes)', () => {
    expect(toReviewQuestion({ id: 'x', quizId: 'z', type: 'WAT', content: 'c' }).type).toBe('ESSAY');
  });
});

describe('typeBadge', () => {
  it('maps each type to a distinct badge', () => {
    expect(typeBadge('MCQ').key).toBe('mcq');
    expect(typeBadge('TRUE_FALSE').key).toBe('trueFalse');
    expect(typeBadge('ESSAY').key).toBe('essay');
  });
});

describe('optionLabel', () => {
  it('produces A/B/C/D', () => {
    expect([0, 1, 2, 3].map(optionLabel)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('validateQuestionDraft', () => {
  const mcq = { type: 'MCQ' as const, content: 'Q', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a', points: 1 };
  it('accepts a valid MCQ', () => {
    expect(validateQuestionDraft(mcq)).toEqual({});
  });
  it('rejects empty content', () => {
    expect(validateQuestionDraft({ ...mcq, content: '   ' }).content).toBeTruthy();
  });
  it('rejects an MCQ without exactly four non-empty options', () => {
    expect(validateQuestionDraft({ ...mcq, options: ['a', 'b', 'c', ''] }).options).toBeTruthy();
    expect(validateQuestionDraft({ ...mcq, options: ['a', 'b', 'c'] }).options).toBeTruthy();
  });
  it('rejects duplicate MCQ options', () => {
    expect(validateQuestionDraft({ ...mcq, options: ['a', 'a', 'c', 'd'] }).options).toBeTruthy();
  });
  it('rejects a correct answer not in options', () => {
    expect(validateQuestionDraft({ ...mcq, correctAnswer: 'z' }).correctAnswer).toBeTruthy();
  });
  it('requires a TF correct answer to be صح/خطأ', () => {
    expect(validateQuestionDraft({ type: 'TRUE_FALSE', content: 'Q', options: ['صح', 'خطأ'], correctAnswer: null, points: 1 }).correctAnswer).toBeTruthy();
    expect(validateQuestionDraft({ type: 'TRUE_FALSE', content: 'Q', options: ['صح', 'خطأ'], correctAnswer: 'صح', points: 1 })).toEqual({});
  });
  it('accepts an essay with only content', () => {
    expect(validateQuestionDraft({ type: 'ESSAY', content: 'Explain', options: [], correctAnswer: null, points: 5 })).toEqual({});
  });
});

describe('draftToApiPayload', () => {
  it('converts MCQ options to a record and keeps the correct answer', () => {
    const p = draftToApiPayload({ type: 'MCQ', content: ' Q ', options: ['a', 'b', 'c', 'd'], correctAnswer: 'b', points: 3 });
    expect(p.content).toBe('Q');
    expect(p.options).toEqual({ '1': 'a', '2': 'b', '3': 'c', '4': 'd' });
    expect(p.correctAnswer).toBe('b');
    expect(p.points).toBe(3);
  });
  it('clears options/answer for essay', () => {
    const p = draftToApiPayload({ type: 'ESSAY', content: 'Explain', options: [], correctAnswer: null, points: 5 });
    expect(p.options).toEqual({});
    expect(p.correctAnswer).toBeNull();
    expect(p.points).toBe(5);
  });
  it('forces TF options to صح/خطأ', () => {
    const p = draftToApiPayload({ type: 'TRUE_FALSE', content: 'Q', options: [], correctAnswer: 'صح', points: 1 });
    expect(Object.values(p.options)).toEqual(['صح', 'خطأ']);
  });
});

describe('optionsToRecord', () => {
  it('uses 1-based keys preserving order', () => {
    expect(optionsToRecord(['x', 'y'])).toEqual({ '1': 'x', '2': 'y' });
  });
});

describe('blankDraft / questionToDraft', () => {
  it('blank MCQ has four empty options', () => {
    expect(blankDraft('MCQ').options).toEqual(['', '', '', '']);
  });
  it('questionToDraft pads MCQ options to four', () => {
    const q: ReviewQuestion = { id: 'q', quizId: 'z', type: 'MCQ', content: 'c', options: ['a', 'b'], correctAnswer: 'a', sortOrder: 1, points: 1 };
    expect(questionToDraft(q).options).toHaveLength(4);
  });
});

describe('validatePoints', () => {
  it('accepts valid whole numbers in [1, 100]', () => {
    expect(validatePoints(1)).toBeNull();
    expect(validatePoints(10)).toBeNull();
    expect(validatePoints(100)).toBeNull();
  });
  it('rejects NaN/empty as required', () => {
    expect(validatePoints(Number.NaN)).toBe('errors.pointsRequired');
  });
  it('rejects decimals', () => {
    expect(validatePoints(2.5)).toBe('errors.pointsInteger');
  });
  it('rejects <= 0', () => {
    expect(validatePoints(0)).toBe('errors.pointsPositive');
    expect(validatePoints(-3)).toBe('errors.pointsPositive');
  });
  it('rejects > 100', () => {
    expect(validatePoints(101)).toBe('errors.pointsMax');
  });
});

describe('points defaults by type', () => {
  it('blankDraft defaults ESSAY=5, MCQ/TF=1', () => {
    expect(blankDraft('ESSAY').points).toBe(5);
    expect(blankDraft('MCQ').points).toBe(1);
    expect(blankDraft('TRUE_FALSE').points).toBe(1);
  });
  it('questionToDraft carries the question points', () => {
    const q: ReviewQuestion = { id: 'q', quizId: 'z', type: 'ESSAY', content: 'c', options: [], correctAnswer: null, sortOrder: 1, points: 8 };
    expect(questionToDraft(q).points).toBe(8);
  });
  it('validateQuestionDraft flags invalid points', () => {
    expect(validateQuestionDraft({ type: 'MCQ', content: 'Q', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a', points: 0 }).points).toBe('errors.pointsPositive');
  });
});

describe('sumQuestionPoints (dynamic total, independent edits)', () => {
  const qs: ReviewQuestion[] = [
    { id: 'a', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 1, points: 1 },
    { id: 'b', quizId: 'z', type: 'ESSAY', content: '', options: [], correctAnswer: null, sortOrder: 2, points: 5 },
  ];
  it('sums question points with no overrides', () => {
    expect(sumQuestionPoints(qs)).toBe(6);
  });
  it('applies a single override without touching the others', () => {
    // Editing question "b" to 10 => total 11; question "a" unchanged.
    expect(sumQuestionPoints(qs, { b: 10 })).toBe(11);
  });
});

describe('generation metadata (teacher-only)', () => {
  it('buildMetadataMap normalizes difficulty and keeps source fields', () => {
    const map = buildMetadataMap([
      { id: 'q1', difficulty: 'medium', sourceLessonId: 'L1', sourceLessonTitle: 'الدرس', sourceChapterTitle: 'الباب' },
      { id: 'q2', difficulty: 'BOGUS', sourceLessonId: null, sourceLessonTitle: null, sourceChapterTitle: 'الباب' },
    ]);
    expect(map.q1).toEqual({ difficulty: 'MEDIUM', sourceLessonId: 'L1', sourceLessonTitle: 'الدرس', sourceChapterTitle: 'الباب' });
    expect(map.q2.difficulty).toBeNull();
    expect(map.q2.sourceLessonId).toBeNull();
  });
  it('mergeMetadata attaches metadata by id and leaves unmatched untouched', () => {
    const qs: ReviewQuestion[] = [
      { id: 'a', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 1, points: 1 },
      { id: 'b', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 2, points: 1 },
    ];
    const merged = mergeMetadata(qs, {
      a: { difficulty: 'HARD', sourceLessonId: 'L1', sourceLessonTitle: 'د١', sourceChapterTitle: 'ب١' },
    });
    expect(merged[0]!.difficulty).toBe('HARD');
    expect(merged[0]!.sourceLessonTitle).toBe('د١');
    expect(merged[1]!.difficulty).toBeUndefined();
  });
});

describe('sortQuestions & reorderIds', () => {
  const qs: ReviewQuestion[] = [
    { id: 'a', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 1, points: 1 },
    { id: 'b', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 2, points: 1 },
    { id: 'c', quizId: 'z', type: 'MCQ', content: '', options: [], correctAnswer: null, sortOrder: 3, points: 1 },
  ];
  it('sorts by sortOrder', () => {
    const shuffled = [qs[2]!, qs[0]!, qs[1]!];
    expect(sortQuestions(shuffled).map((q) => q.id)).toEqual(['a', 'b', 'c']);
  });
  it('reorders ids by moving one item (stable ids)', () => {
    expect(reorderIds(qs, 'a', 'c')).toEqual(['b', 'c', 'a']);
  });
  it('is a no-op when moving onto itself', () => {
    expect(reorderIds(qs, 'a', 'a')).toEqual(['a', 'b', 'c']);
  });
});
