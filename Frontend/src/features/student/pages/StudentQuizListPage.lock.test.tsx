// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { StudentQuizListPage } from './StudentQuizListPage';
import { useStudentQuizzes } from '@/features/student/hooks/useStudentQuizzes';
import type { QuizItem, StudentQuizzesData } from '@/features/student/types/studentQuiz';

// t returns the key (interpolating numeric count), so we assert against keys
// and the backend-provided Arabic lockReason strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

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

function loaded(data: StudentQuizzesData) {
  mockUseStudentQuizzes.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentQuizListPage />
    </MemoryRouter>,
  );
}

const LOCK_REASON = 'أكمل مشاهدة الدرس أولًا';
const PREV_REASON = 'يجب إنهاء الكويز السابق أولًا';

/** One chapter with a locked lesson quiz, an unlocked quiz, and a locked chapter quiz. */
function lockData(): StudentQuizzesData {
  return {
    totalCount: 3,
    completedCount: 0,
    newCount: 3,
    chapters: [
      {
        id: 'c1',
        title: 'Chapter One',
        stage: 'Grade 10',
        defaultOpen: true,
        quizzes: [
          quiz({
            id: 'locked-lesson',
            title: 'Locked Lesson Quiz',
            quizScope: 'LESSON',
            isUnlocked: false,
            canTake: false,
            lockReason: LOCK_REASON,
            lockReasonCode: 'LESSON_NOT_COMPLETED',
          }),
          quiz({
            id: 'unlocked',
            title: 'Unlocked Quiz',
            quizScope: 'LESSON',
            isUnlocked: true,
            canTake: true,
          }),
          quiz({
            id: 'locked-chapter',
            title: 'Locked Chapter Quiz',
            quizScope: 'CHAPTER',
            isUnlocked: false,
            canTake: false,
            lockReason: PREV_REASON,
            lockReasonCode: 'PREVIOUS_QUIZ_NOT_COMPLETED',
          }),
        ],
      },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('StudentQuizListPage — lock / unlock behavior', () => {
  it('1. renders locked and unlocked quizzes (locked stay visible)', () => {
    loaded(lockData());
    renderPage();
    expect(screen.getByText('Locked Lesson Quiz')).toBeInTheDocument();
    expect(screen.getByText('Unlocked Quiz')).toBeInTheDocument();
    expect(screen.getByText('Locked Chapter Quiz')).toBeInTheDocument();
  });

  it('2. locked quiz has a disabled Take Quiz button', () => {
    loaded(lockData());
    renderPage();
    const row = screen.getByText('Locked Lesson Quiz').closest('div.flex')!.parentElement!;
    const buttons = within(row).getAllByRole('button');
    const startBtn = buttons.find((b) => b.textContent?.includes('quiz:quiz.action.start'));
    expect(startBtn).toBeDefined();
    expect(startBtn).toBeDisabled();
  });

  it('3. locked quiz displays the lock reason via i18n (keyed by lockReasonCode)', () => {
    loaded(lockData());
    renderPage();
    // Lock reason is rendered through i18n; the mocked t() returns the key.
    expect(
      screen.getByText('quiz:quiz.lockReasons.LESSON_NOT_COMPLETED'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('quiz:quiz.lockReasons.PREVIOUS_QUIZ_NOT_COMPLETED'),
    ).toBeInTheDocument();
  });

  it('4. unlocked quiz start button is enabled and navigates', () => {
    loaded(lockData());
    renderPage();
    const row = screen.getByText('Unlocked Quiz').closest('div.flex')!.parentElement!;
    const startBtn = within(row)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('quiz:quiz.action.start'))!;
    expect(startBtn).toBeEnabled();
    fireEvent.click(startBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/student/quizzes/unlocked');
  });

  it('5. clicking a locked quiz does not navigate', () => {
    loaded(lockData());
    renderPage();
    const row = screen.getByText('Locked Lesson Quiz').closest('div.flex')!.parentElement!;
    const startBtn = within(row)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('quiz:quiz.action.start'))!;
    fireEvent.click(startBtn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('6. chapter quiz shows the chapter-quiz label', () => {
    loaded(lockData());
    renderPage();
    // Rendered via the quiz:quiz.chapterQuiz i18n key (mock returns the key).
    expect(screen.getByText('quiz:quiz.chapterQuiz')).toBeInTheDocument();
  });
});
