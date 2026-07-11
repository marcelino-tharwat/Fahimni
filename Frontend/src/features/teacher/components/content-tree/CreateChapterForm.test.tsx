// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateChapterForm } from './CreateChapterForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/shared/store/slices/toastSlice', () => ({ addToast: vi.fn() }));
vi.mock('@/features/teacher/hooks/useChapters', () => ({
  useCreateChapter: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/teacher/hooks/useTeacherProfile', () => ({
  useTeacherProfile: () => ({ data: { subject: 'الفيزياء' } }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('CreateChapterForm', () => {
  it('shows the teacher subject as locked/read-only', () => {
    render(<CreateChapterForm parentStageId="stage-1" nextSortOrder={1} onCreated={vi.fn()} />);

    const subjectInput = screen.getByDisplayValue('الفيزياء');
    expect(subjectInput).toBeDisabled();
    expect(screen.getByText('Subject is locked to your approved teacher profile.')).toBeInTheDocument();
  });
});
