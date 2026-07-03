import { describe, it, expect, vi } from 'vitest';
import { formatQuizScopeLabel } from './quizScopeLabel';

const t = vi.fn((key: string, opts?: Record<string, unknown>) => {
  if (opts?.lesson) return `lesson:${opts.lesson}`;
  if (opts?.count) return `count:${opts.count}`;
  return key;
});

describe('formatQuizScopeLabel', () => {
  it('returns chapter scope label', () => {
    expect(
      formatQuizScopeLabel(
        { contentScope: 'CHAPTER', chapter: { id: 'c', title: 'Ch' }, lessons: [] },
        t,
      ),
    ).toBe('teacher:publish.scopeChapter');
  });

  it('returns one-lesson label', () => {
    expect(
      formatQuizScopeLabel(
        {
          contentScope: 'SELECTED_LESSONS',
          chapter: { id: 'c', title: 'Ch' },
          lessons: [{ id: 'l1', title: 'Lesson A' }],
        },
        t,
      ),
    ).toBe('lesson:Lesson A');
  });
});
