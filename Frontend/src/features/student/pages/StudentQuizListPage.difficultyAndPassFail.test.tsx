// @vitest-environment jsdom
// Regression tests for a bug found while auditing /student/quizzes: the
// difficulty badge used to always show "Medium" (backend hardcode) and the
// pass/fail badge was suspected of always showing "Passed 100%". The backend
// hardcode is now fixed (Quiz.difficulty is a real, persisted column); this
// file proves the frontend badges render correctly for every real value the
// backend can now send, and that no pass/fail badge appears for an
// unattempted quiz.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { StudentQuizListPage } from './StudentQuizListPage';
import { useStudentQuizzes } from '@/features/student/hooks/useStudentQuizzes';
import type { QuizItem, StudentQuizzesData } from '@/features/student/types/studentQuiz';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts.score === 'number' ? `${key}:${opts.score}` : key,
  }),
}));

vi.mock('@/features/student/hooks/useStudentQuizzes', () => ({
  useStudentQuizzes: vi.fn(),
}));

const mockUseStudentQuizzes = useStudentQuizzes as unknown as ReturnType<typeof vi.fn>;

function quiz(overrides: Partial<QuizItem> = {}): QuizItem {
  return {
    id: 'q',
    title: 'Quiz',
    questionCount: 5,
    points: 10,
    durationMinutes: 30,
    difficulty: 'medium',
    status: 'new',
    ...overrides,
  };
}

function singleChapterData(item: QuizItem): StudentQuizzesData {
  return {
    totalCount: 1,
    completedCount: item.status === 'passed' || item.status === 'failed' ? 1 : 0,
    newCount: item.status === 'new' ? 1 : 0,
    chapters: [
      { id: 'c1', title: 'Chapter One', stage: 'Grade 10', defaultOpen: true, quizzes: [item] },
    ],
  };
}

function loaded(data: StudentQuizzesData) {
  mockUseStudentQuizzes.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentQuizListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('StudentQuizListPage — difficulty badge is fully backend-driven', () => {
  it('1. EASY renders the easy i18n key with the success (green) tone class', () => {
    loaded(singleChapterData(quiz({ id: 'q1', difficulty: 'easy' })));
    renderPage();

    const badge = screen.getByText('quiz:difficulty.easy');
    expect(badge.className).toMatch(/text-success/);
  });

  it('2. MEDIUM renders the medium i18n key with the warning (amber) tone class', () => {
    loaded(singleChapterData(quiz({ id: 'q2', difficulty: 'medium' })));
    renderPage();

    const badge = screen.getByText('quiz:difficulty.medium');
    expect(badge.className).toMatch(/text-warning/);
  });

  it('3. HARD renders the hard i18n key with the danger (red) tone class', () => {
    loaded(singleChapterData(quiz({ id: 'q3', difficulty: 'hard' })));
    renderPage();

    const badge = screen.getByText('quiz:difficulty.hard');
    expect(badge.className).toMatch(/text-danger/);
  });

  it('7. no hardcoded "Medium" or "Passed 100%" string is ever rendered for HARD + unattempted data', () => {
    loaded(singleChapterData(quiz({ id: 'q4', difficulty: 'hard', status: 'new' })));
    renderPage();

    expect(screen.queryByText('Medium')).not.toBeInTheDocument();
    expect(screen.queryByText(/Passed 100%/)).not.toBeInTheDocument();
    expect(screen.queryByText('quiz:difficulty.medium')).not.toBeInTheDocument();
  });
});

describe('StudentQuizListPage — pass/fail badge only renders for a real completed attempt', () => {
  it('4. no pass/fail badge renders for an unattempted (status: new) quiz', () => {
    loaded(singleChapterData(quiz({ id: 'q5', status: 'new' })));
    renderPage();

    expect(screen.queryByText(/quiz:quiz\.status\.passed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quiz:quiz\.status\.failed/)).not.toBeInTheDocument();
  });

  it('5. renders "Passed" in green with the real score percent when passed === true', () => {
    loaded(singleChapterData(quiz({ id: 'q6', status: 'passed', score: 67, attemptId: 'a1' })));
    renderPage();

    const badges = screen.getAllByText('quiz:quiz.status.passed:67');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]!.className).toMatch(/text-success/);
  });

  it('6. renders "Failed" in red with the real score percent when passed === false', () => {
    loaded(singleChapterData(quiz({ id: 'q7', status: 'failed', score: 33, attemptId: 'a2', retakeAllowed: true })));
    renderPage();

    const badges = screen.getAllByText('quiz:quiz.status.failed:33');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]!.className).toMatch(/text-danger/);
  });
});
