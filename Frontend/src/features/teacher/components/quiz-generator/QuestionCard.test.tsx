// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { QuestionCard } from './QuestionCard';
import type { ReviewQuestion } from '@/features/teacher/lib/quizReview';

// Echo translation keys so we assert on stable identifiers; raw data (lesson
// titles, points values) passes through unchanged.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => cleanup());

function renderCard(question: ReviewQuestion, handlers: Partial<{
  onPointsChange: (p: number) => void;
  onPointsCommit: (p: number) => void;
}> = {}) {
  return render(
    <DndContext>
      <SortableContext items={[question.id]}>
        <QuestionCard
          question={question}
          index={1}
          onEdit={() => {}}
          onDelete={() => {}}
          onPointsChange={handlers.onPointsChange}
          onPointsCommit={handlers.onPointsCommit}
        />
      </SortableContext>
    </DndContext>,
  );
}

const withMeta: ReviewQuestion = {
  id: 'q1',
  quizId: 'z',
  type: 'MCQ',
  content: 'ما هي عاصمة مصر؟',
  options: ['القاهرة', 'الجيزة'],
  correctAnswer: 'القاهرة',
  sortOrder: 1,
  points: 3,
  difficulty: 'HARD',
  sourceLessonId: 'L1',
  sourceLessonTitle: 'الدرس الأول',
  sourceChapterTitle: 'الباب الأول',
};

describe('QuestionCard — teacher metadata + editable points', () => {
  it('renders source lesson, chapter and difficulty metadata', () => {
    renderCard(withMeta);
    expect(screen.getByText('الدرس الأول')).toBeInTheDocument();
    expect(screen.getByText('الباب الأول')).toBeInTheDocument();
    // Difficulty label resolves via the difficulty.<level> key.
    expect(
      screen.getByText('teacher:quizGenerator.review.difficulty.hard'),
    ).toBeInTheDocument();
  });

  it('renders an editable points input seeded from the question', () => {
    renderCard(withMeta);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  it('shows "غير محدد" (key) when the source lesson is missing', () => {
    renderCard({ ...withMeta, sourceLessonId: null, sourceLessonTitle: null, difficulty: null });
    const notSpecified = screen.getAllByText('teacher:quizGenerator.review.metadata.notSpecified');
    // At least the lesson + difficulty fall back to "not specified".
    expect(notSpecified.length).toBeGreaterThanOrEqual(2);
  });

  it('emits the new value on valid change and commits on blur', () => {
    const onPointsChange = vi.fn();
    const onPointsCommit = vi.fn();
    renderCard(withMeta, { onPointsChange, onPointsCommit });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });
    expect(onPointsChange).toHaveBeenLastCalledWith(7);
    fireEvent.blur(input);
    expect(onPointsCommit).toHaveBeenCalledWith(7);
  });

  it('shows a validation message and does not commit invalid points', () => {
    const onPointsChange = vi.fn();
    const onPointsCommit = vi.fn();
    renderCard(withMeta, { onPointsChange, onPointsCommit });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(
      screen.getByText('teacher:quizGenerator.review.errors.pointsInteger'),
    ).toBeInTheDocument();
    // No live change propagated for the invalid value.
    expect(onPointsChange).not.toHaveBeenCalled();
    // Blur reverts to the last valid value → no commit.
    fireEvent.blur(input);
    expect(onPointsCommit).not.toHaveBeenCalled();
  });
});
