// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResultQuestionCard } from './ResultQuestionCard';
import type { QuestionResult } from '@/features/student/types/quizResults';

// Return the translation key verbatim so tests assert on stable identifiers
// (and can prove correctness labels/keys are absent) without a full i18n setup.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'points' in opts ? `${key}:${opts.points}` : key,
  }),
}));

afterEach(() => cleanup());

const mcq: QuestionResult['question'] = {
  id: 'm1',
  type: 'mcq',
  text: 'Q1',
  points: 2,
  options: [
    { id: 'a', label: 'أ', text: 'Cairo' },
    { id: 'b', label: 'ب', text: 'Giza' },
  ],
};

/** Correctness hidden: only the student's answer is exposed (status 'answered'). */
function neutralResult(): QuestionResult {
  return {
    question: mcq,
    studentAnswer: 'Cairo',
    status: 'answered',
    awardedPoints: null,
    maxPoints: 0,
    scoreVisible: false,
  };
}

/** Correctness visible: the student sees the full right/wrong review. */
function incorrectResult(): QuestionResult {
  return {
    question: mcq,
    studentAnswer: 'Cairo',
    status: 'incorrect',
    awardedPoints: 0,
    maxPoints: 2,
    scoreVisible: true,
    correctAnswer: 'Giza',
  };
}

describe('ResultQuestionCard — correctness hidden (neutral)', () => {
  it('renders the student answer with neutral styling only', () => {
    render(<ResultQuestionCard result={neutralResult()} index={0} />);
    // The student's chosen option is present…
    expect(screen.getByText('Cairo')).toBeInTheDocument();
    // …with the neutral "answered" status label, not a right/wrong verdict.
    expect(screen.getByText('quiz:results.answered')).toBeInTheDocument();
    expect(screen.queryByText('quiz:results.correctAnswer')).not.toBeInTheDocument();
    expect(screen.queryByText('quiz:results.wrongAnswer')).not.toBeInTheDocument();
  });

  it('renders no correct/wrong (green/red) styling', () => {
    const { container } = render(<ResultQuestionCard result={neutralResult()} index={0} />);
    expect(container.querySelectorAll('[class*="success"]')).toHaveLength(0);
    expect(container.querySelectorAll('[class*="danger"]')).toHaveLength(0);
  });

  it('renders no correct-answer reveal and no per-question score', () => {
    render(<ResultQuestionCard result={neutralResult()} index={0} />);
    expect(screen.queryByText('quiz:results.correctAnswerLabel')).not.toBeInTheDocument();
    // pointsEarned / pointsZero / pointsPending keys must be absent.
    expect(screen.queryByText(/quiz:results\.points/)).not.toBeInTheDocument();
  });
});

describe('ResultQuestionCard — correctness visible', () => {
  it('keeps the right/wrong review when correctness is allowed', () => {
    const { container } = render(<ResultQuestionCard result={incorrectResult()} index={0} />);
    expect(screen.getByText('quiz:results.wrongAnswer')).toBeInTheDocument();
    expect(screen.getByText('quiz:results.correctAnswerLabel')).toBeInTheDocument();
    // Danger styling for the wrong answer is present.
    expect(container.querySelectorAll('[class*="danger"]').length).toBeGreaterThan(0);
  });
});
