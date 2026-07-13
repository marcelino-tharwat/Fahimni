// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QuestionCard } from './QuestionCard';
import type { QuizQuestion } from '@/shared/types';

// Regression coverage: the true/false answer row previously used `flex gap-3`
// (no wrap) with two `min-w-[140px]` buttons — on a 320-375px viewport the
// card's own padding left less room than the two buttons needed, forcing
// horizontal overflow on the exam-taking screen. Fixed to `flex flex-wrap`
// with `min-w-[120px]`, matching the already-correct pattern in
// ResultQuestionCard.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }));

const tfQuestion: QuizQuestion = {
  id: 'q1',
  type: 'tf',
  text: 'Water boils at 100°C at sea level.',
  points: 1,
};

afterEach(() => cleanup());

describe('QuestionCard — true/false row does not force overflow on mobile', () => {
  it('1. the answer row wraps instead of forcing a fixed-width overflow', () => {
    render(
      <QuestionCard
        question={tfQuestion}
        index={0}
        answer=""
        onAnswer={vi.fn()}
        hasError={false}
        isPulsing={false}
      />,
    );
    const trueButton = screen.getByText('صح');
    const row = trueButton.closest('div')!;
    expect(row.className).toMatch(/flex-wrap/);
  });

  it('2. each true/false button uses the smaller min-width that fits a 320px viewport', () => {
    render(
      <QuestionCard
        question={tfQuestion}
        index={0}
        answer=""
        onAnswer={vi.fn()}
        hasError={false}
        isPulsing={false}
      />,
    );
    const trueButton = screen.getByText('صح').closest('button')!;
    expect(trueButton.className).toMatch(/min-w-\[120px\]/);
    expect(trueButton.className).not.toMatch(/min-w-\[140px\]/);
  });
});
