import { describe, expect, it } from 'vitest';

/** Mirrors LessonPage next-button gating — backend nextLessonId is the only unlock signal. */
export function shouldShowNextLessonButton(input: {
  nextLessonId: string | null | undefined;
  nextLessonTitle: string | null | undefined;
}): boolean {
  return Boolean(input.nextLessonId && input.nextLessonTitle);
}

export function shouldShowQuizLockedHint(input: {
  nextLessonId: string | null | undefined;
  isLessonCompleted: boolean;
  requiredQuizId: string | null | undefined;
}): boolean {
  return !input.nextLessonId && input.isLessonCompleted && Boolean(input.requiredQuizId);
}

describe('lesson next navigation gating', () => {
  it('does not enable Next when backend nextLessonId is null after completion', () => {
    expect(
      shouldShowNextLessonButton({ nextLessonId: null, nextLessonTitle: 'Lesson 2' }),
    ).toBe(false);
  });

  it('enables Next only when backend provides nextLessonId and title', () => {
    expect(
      shouldShowNextLessonButton({ nextLessonId: 'l2', nextLessonTitle: 'Lesson 2' }),
    ).toBe(true);
  });

  it('shows quiz locked hint when lesson completed with required quiz but no nextLessonId', () => {
    expect(
      shouldShowQuizLockedHint({
        nextLessonId: null,
        isLessonCompleted: true,
        requiredQuizId: 'q1',
      }),
    ).toBe(true);
  });

  it('does not show quiz locked hint for optional lesson-linked quiz', () => {
    expect(
      shouldShowQuizLockedHint({
        nextLessonId: 'l2',
        isLessonCompleted: true,
        requiredQuizId: null,
      }),
    ).toBe(false);
  });
});
