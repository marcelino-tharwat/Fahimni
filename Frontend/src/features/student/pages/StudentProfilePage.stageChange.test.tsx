// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/shared/lib/i18n';
import { StudentProfilePage } from './StudentProfilePage';
import type { StudentProfileResponse, StageChangePolicy } from '@/features/student/types/studentProfile';

vi.mock('@/features/student/hooks/useStudentProfile', () => ({
  useUpdateStudentProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useStudentProfile: () => ({ data: null }),
}));

const overview: StudentProfileResponse = {
  student: {
    id: 's1',
    fullName: 'Test Student',
    avatarInitial: 'T',
    role: 'STUDENT',
    status: 'ACTIVE',
    email: 'test@example.com',
    phone: '01012345678',
    joinedAt: '2026-01-01T00:00:00.000Z',
    stageName: 'First Secondary',
  },
  academicProgress: {
    completedLessons: 5,
    totalLessons: 20,
    completedQuizzes: 2,
    averageGrade: 80,
    overallProgressPercent: 25,
  },
  courses: [],
  subscriptions: [],
  achievements: [],
};

vi.mock('@/features/student/hooks/useStudentProfileOverview', () => ({
  useStudentProfileOverview: () => ({
    data: overview,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

const changeStageMock = vi.fn();
const policyData: StageChangePolicy = {
  currentStage: { id: 'stage-1', name: 'الأولى الإعدادي', sortOrder: 1 },
  availableStages: [
    { id: 'stage-2', name: 'الثاني الإعدادي', sortOrder: 2 },
    { id: 'stage-3', name: 'الثالث الإعدادي', sortOrder: 3 },
  ],
  canChangeStage: true,
  reason: null,
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-08-31T23:59:59.000Z',
  academicYear: '2026',
  alreadyChangedThisYear: false,
};

const policyQueryResult = {
  data: policyData,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  isFetching: false,
  isSuccess: true,
  isPending: false,
  status: 'success' as const,
  dataUpdatedAt: 0,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  fetchStatus: 'idle' as const,
  isStale: false,
  remove: vi.fn(),
};

const useStageChangePolicyMock = vi.fn(() => policyQueryResult);
const useChangeStageMock = vi.fn(() => ({
  mutate: changeStageMock,
  isPending: false,
}));

vi.mock('@/features/student/hooks/useStageChange', () => ({
  get useStageChangePolicy() {
    return useStageChangePolicyMock;
  },
  get useChangeStage() {
    return useChangeStageMock;
  },
}));

vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));

afterEach(() => cleanup());

describe('StudentProfilePage — StageChangeCard', () => {
  it('renders current stage and available options', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('تغيير المرحلة الدراسية')).toBeInTheDocument();
    expect(screen.getByText('الأولى الإعدادي')).toBeInTheDocument();
    expect(screen.getByText(/متاح من/)).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
  });

  it('disables change button when no stage is selected', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /تغيير المرحلة/ });
    expect(button).toBeDisabled();
  });

  it('enables change button when a stage is selected', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'stage-2' } });

    const button = screen.getByRole('button', { name: /تغيير المرحلة/ });
    expect(button).not.toBeDisabled();
  });

  it('shows confirmation modal when clicking change', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'stage-2' } });
    fireEvent.click(screen.getByRole('button', { name: /تغيير المرحلة/ }));

    expect(screen.getByText('تأكيد تغيير المرحلة')).toBeInTheDocument();
    expect(screen.getByText(/هل أنت متأكد/)).toBeInTheDocument();
  });

  it('calls mutate on confirm', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'stage-3' } });
    fireEvent.click(screen.getByRole('button', { name: /تغيير المرحلة/ }));

    const confirmBtn = screen.getByRole('button', { name: 'تأكيد' });
    fireEvent.click(confirmBtn);

    expect(changeStageMock).toHaveBeenCalledWith('stage-3', expect.anything());
  });

  it('shows already-changed message when alreadyChangedThisYear is true', async () => {
    useStageChangePolicyMock.mockReturnValueOnce({
      ...policyQueryResult,
      data: {
        ...policyData,
        canChangeStage: false,
        reason: 'لقد قمت بتغيير المرحلة الدراسية بالفعل هذا العام.',
        alreadyChangedThisYear: true,
      },
    });

    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('لقد قمت بتغيير المرحلة بالفعل هذا العام')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows no-stages message when no forward stages exist', async () => {
    useStageChangePolicyMock.mockReturnValueOnce({
      ...policyQueryResult,
      data: {
        ...policyData,
        canChangeStage: false,
        reason: 'لا توجد مرحلة أعلى متاحة للتغيير إليها.',
        availableStages: [],
      },
    });

    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('لا توجد مراحل متاحة للتغيير إليها')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
