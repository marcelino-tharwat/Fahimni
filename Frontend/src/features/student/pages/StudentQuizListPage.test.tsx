// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { StudentQuizListPage } from './StudentQuizListPage';
import { useStudentQuizzes } from '@/features/student/hooks/useStudentQuizzes';
import type {
  QuizItem,
  StudentQuizzesData,
} from '@/features/student/types/studentQuiz';

// t returns the key, interpolating a numeric `count` so count-based labels are
// assertable (e.g. "…chapterCount:5").
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

/** Full spread across all three scope buckets, with stats counting them all. */
function mixedData(): StudentQuizzesData {
  return {
    totalCount: 4,
    completedCount: 1,
    newCount: 3,
    chapters: [
      {
        id: 'c1',
        title: 'Chapter One',
        stage: 'Grade 10',
        defaultOpen: true,
        quizzes: [
          quiz({
            id: 'full',
            title: 'Full Curriculum Quiz',
            sourceScope: 'FULL_CURRICULUM',
            sourceStage: { id: 's1', title: 'Grade 10 Stage' },
          }),
          quiz({
            id: 'multi',
            title: 'Multi Chapter Quiz',
            sourceScope: 'MULTI_CHAPTER',
            sourceChapters: [
              { id: 'c1', title: 'Source Alpha' },
              { id: 'c2', title: 'Source Beta' },
            ],
          }),
          quiz({
            id: 'single',
            title: 'Single Chapter Quiz',
            sourceScope: 'SINGLE_CHAPTER',
          }),
        ],
      },
      {
        id: 'c2',
        title: 'Chapter Two',
        stage: 'Grade 10',
        defaultOpen: true,
        quizzes: [
          quiz({
            id: 'passed',
            title: 'Passed Single Quiz',
            sourceScope: 'SINGLE_CHAPTER',
            status: 'passed',
            score: 90,
            attemptId: 'a1',
          }),
        ],
      },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('StudentQuizListPage — scope sections', () => {
  it('1. renders all three sections when each bucket is non-empty', () => {
    loaded(mixedData());
    renderPage();

    expect(
      screen.getByText('student:quizzes.sections.fullCurriculum.title'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('student:quizzes.sections.multiChapter.title'),
    ).toBeInTheDocument();
    // Per-chapter accordions: only single-chapter chapters remain.
    expect(screen.getByText('Chapter One')).toBeInTheDocument();
    expect(screen.getByText('Chapter Two')).toBeInTheDocument();
  });

  it('2. Full Curriculum section shows the "شاملة" badge + stage chip', () => {
    loaded(mixedData());
    renderPage();

    const section = screen
      .getByText('student:quizzes.sections.fullCurriculum.title')
      .closest('section') as HTMLElement;
    expect(
      within(section).getByText('student:quizzes.sections.fullCurriculum.badge'),
    ).toBeInTheDocument();
    expect(within(section).getByText('Grade 10 Stage')).toBeInTheDocument();
    expect(within(section).getByText('Full Curriculum Quiz')).toBeInTheDocument();
  });

  it('3. Multi-Chapter section shows the badge + chapter chips', () => {
    loaded(mixedData());
    renderPage();

    const section = screen
      .getByText('student:quizzes.sections.multiChapter.title')
      .closest('section') as HTMLElement;
    expect(
      within(section).getByText('student:quizzes.sections.multiChapter.badge'),
    ).toBeInTheDocument();
    // 2 chapters → individual chips (≤ 3).
    expect(within(section).getByText('Source Alpha')).toBeInTheDocument();
    expect(within(section).getByText('Source Beta')).toBeInTheDocument();
  });

  it('3b. Multi-Chapter collapses to a count chip when > 3 chapters', () => {
    loaded({
      totalCount: 1,
      completedCount: 0,
      newCount: 1,
      chapters: [
        {
          id: 'c1',
          title: 'Chapter One',
          stage: 'Grade 10',
          defaultOpen: true,
          quizzes: [
            quiz({
              id: 'multi',
              sourceScope: 'MULTI_CHAPTER',
              sourceChapters: [
                { id: 'c1', title: 'One' },
                { id: 'c2', title: 'Two' },
                { id: 'c3', title: 'Three' },
                { id: 'c4', title: 'Four' },
              ],
            }),
          ],
        },
      ],
    });
    renderPage();

    expect(
      screen.getByText('student:quizzes.sections.multiChapter.chapterCount:4'),
    ).toBeInTheDocument();
  });

  it('4. per-chapter accordions contain only single-chapter quizzes (no duplication)', () => {
    loaded(mixedData());
    renderPage();

    // The full/multi quizzes must NOT appear inside a chapter accordion body.
    // They render once (in their top section); their titles appear exactly once.
    expect(screen.getAllByText('Full Curriculum Quiz')).toHaveLength(1);
    expect(screen.getAllByText('Multi Chapter Quiz')).toHaveLength(1);
    expect(screen.getAllByText('Single Chapter Quiz')).toHaveLength(1);
  });

  it('5. stats cards count ALL quizzes across every section', () => {
    loaded(mixedData());
    renderPage();

    // totalCount (4), completedCount (1), newCount (3) from the backend totals.
    expect(screen.getByText('4')).toBeInTheDocument();
    const completed = screen.getAllByText('student:quizzes.stats.completed');
    expect(completed.length).toBeGreaterThan(0);
    // total = 4 covers all buckets (1 full + 1 multi + 2 single).
  });

  it('6. a legacy quiz (missing scope) falls back to its chapter accordion', () => {
    loaded({
      totalCount: 1,
      completedCount: 0,
      newCount: 1,
      chapters: [
        {
          id: 'c1',
          title: 'Legacy Chapter',
          stage: 'Grade 10',
          defaultOpen: true,
          quizzes: [quiz({ id: 'legacy', title: 'Legacy Quiz' })], // no sourceScope
        },
      ],
    });
    renderPage();

    expect(
      screen.queryByText('student:quizzes.sections.fullCurriculum.title'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('student:quizzes.sections.multiChapter.title'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Legacy Chapter')).toBeInTheDocument();
    expect(screen.getByText('Legacy Quiz')).toBeInTheDocument();
  });

  it('7. Start works from a top section and View Result from another', () => {
    loaded(mixedData());
    renderPage();

    // Start on the full-curriculum (new) quiz.
    const fullSection = screen
      .getByText('student:quizzes.sections.fullCurriculum.title')
      .closest('section') as HTMLElement;
    fireEvent.click(within(fullSection).getByText('quiz:quiz.action.start'));
    expect(mockNavigate).toHaveBeenCalledWith('/student/quizzes/full');

    // View Result on the passed single-chapter quiz (inside a chapter accordion).
    fireEvent.click(screen.getByText('quiz:quiz.action.viewResult'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/student/quizzes/passed/results/a1',
    );
  });

  it('8. global empty state renders only when all three buckets are empty', () => {
    loaded({ totalCount: 0, completedCount: 0, newCount: 0, chapters: [] });
    renderPage();

    expect(screen.getByText('student:quizzes.empty.title')).toBeInTheDocument();
    expect(
      screen.queryByText('student:quizzes.sections.fullCurriculum.title'),
    ).not.toBeInTheDocument();
  });

  it('9. a required-gate quiz living in a top section is still startable', () => {
    // Progression gating is enforced by the backend on start; the list must keep
    // the quiz reachable/startable from its new top-level section.
    loaded({
      totalCount: 1,
      completedCount: 0,
      newCount: 1,
      chapters: [
        {
          id: 'c1',
          title: 'Chapter One',
          stage: 'Grade 10',
          defaultOpen: true,
          quizzes: [
            quiz({
              id: 'gate',
              title: 'Gate Quiz',
              sourceScope: 'FULL_CURRICULUM',
              status: 'new',
            }),
          ],
        },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByText('quiz:quiz.action.start'));
    expect(mockNavigate).toHaveBeenCalledWith('/student/quizzes/gate');
  });
});
