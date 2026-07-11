// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/shared/lib/i18n';
import { StudentProfilePage } from './StudentProfilePage';
import type { StudentProfileResponse } from '@/features/student/types/studentProfile';

const mutateMock = vi.fn();
vi.mock('@/features/student/hooks/useStudentProfile', () => ({
  useUpdateStudentProfile: () => ({ mutate: mutateMock, isPending: false }),
}));

const overview: StudentProfileResponse = {
  student: {
    id: 's1',
    fullName: 'Sara Ahmed',
    avatarInitial: 'S',
    role: 'STUDENT',
    status: 'ACTIVE',
    email: 'sara@example.com',
    phone: '01012345678',
    joinedAt: '2026-01-01T00:00:00.000Z',
    stageName: 'Grade 1',
  },
  academicProgress: {
    completedLessons: 0,
    totalLessons: 0,
    completedQuizzes: 0,
    averageGrade: null,
    overallProgressPercent: 0,
  },
  courses: [],
  subscriptions: [],
  achievements: [],
};
vi.mock('@/features/student/hooks/useStudentProfileOverview', () => ({
  useStudentProfileOverview: () => ({ data: overview, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }),
}));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));

afterEach(() => cleanup());

describe('StudentProfilePage — whitespace-only name rejected before save', () => {
  it('a whitespace-only name disables Save and never calls updateProfile', async () => {
    await i18n.changeLanguage('ar');
    render(<MemoryRouter><StudentProfilePage /></MemoryRouter>);

    fireEvent.click(screen.getByText('تعديل الملف الشخصي'));
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: '   ' } });

    const saveButton = screen.getByText('حفظ', { selector: 'button' });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('a valid save trims the name before calling updateProfile', async () => {
    await i18n.changeLanguage('ar');
    render(<MemoryRouter><StudentProfilePage /></MemoryRouter>);

    fireEvent.click(screen.getByText('تعديل الملف الشخصي'));
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: '  Sara Ahmed  ' } });
    fireEvent.click(screen.getByText('حفظ', { selector: 'button' }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Sara Ahmed' }),
      expect.anything(),
    );
  });
});
