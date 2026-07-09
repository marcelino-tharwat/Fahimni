// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TeacherAccessGuard } from './TeacherAccessGuard';
import { TeacherRejectedPage } from '@/features/teacher/pages/TeacherRejectedPage';
import { TeacherPendingReviewPage } from '@/features/teacher/pages/TeacherPendingReviewPage';
import { useAppSelector } from '@/shared/store/hooks';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import type { User } from '@/shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ar' } }),
}));
vi.mock('@/shared/store/hooks', () => ({ useAppSelector: vi.fn() }));
vi.mock('@/features/teacher/api/teacherPlans', () => ({
  teacherPlansApi: { getMySubscription: vi.fn() },
}));

const mSelector = useAppSelector as unknown as ReturnType<typeof vi.fn>;
const mApi = teacherPlansApi as unknown as { getMySubscription: ReturnType<typeof vi.fn> };

function teacher(state: User['teacherApprovalState']): User {
  return { id: 't1', fullName: 'T', email: 't@x.local', mobile: '01000000001', role: 'OPERATION', status: 'ACTIVE', teacherApprovalState: state, createdAt: '2026-01-01T00:00:00.000Z' };
}
function setUser(u: User | null) {
  mSelector.mockImplementation((sel: (s: unknown) => unknown) => sel({ auth: { user: u } }));
}

function renderGuardAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<TeacherAccessGuard />}>
            <Route path="/teacher/dashboard" element={<div>TEACHER DASHBOARD</div>} />
          </Route>
          <Route path="/teacher/pending-review" element={<div>PENDING PAGE</div>} />
          <Route path="/teacher/rejected" element={<div>REJECTED PAGE</div>} />
          <Route path="/teacher/plans" element={<div>PLANS PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherAccessGuard', () => {
  it('5a. PENDING_REVIEW teacher is redirected to pending-review', async () => {
    setUser(teacher('PENDING_REVIEW'));
    renderGuardAt('/teacher/dashboard');
    expect(await screen.findByText('PENDING PAGE')).toBeInTheDocument();
    expect(screen.queryByText('TEACHER DASHBOARD')).not.toBeInTheDocument();
  });

  it('5b. REJECTED teacher is redirected to rejected page', async () => {
    setUser(teacher('REJECTED'));
    renderGuardAt('/teacher/dashboard');
    expect(await screen.findByText('REJECTED PAGE')).toBeInTheDocument();
  });

  it('6/7. APPROVED FREE-plan teacher (no paid sub) CAN access the dashboard', async () => {
    setUser(teacher('APPROVED'));
    mApi.getMySubscription.mockResolvedValue({
      subscription: null,
      accessState: 'FREE_PLAN',
    } as never);
    renderGuardAt('/teacher/dashboard');
    await waitFor(() => expect(screen.getByText('TEACHER DASHBOARD')).toBeInTheDocument());
    expect(screen.queryByText('PLANS PAGE')).not.toBeInTheDocument();
  });

  it('9. APPROVED teacher with PAID plan can access the dashboard', async () => {
    setUser(teacher('APPROVED'));
    mApi.getMySubscription.mockResolvedValue({
      subscription: { status: 'ACTIVE' },
      accessState: 'PAID_PLAN',
    } as never);
    renderGuardAt('/teacher/dashboard');
    await waitFor(() => expect(screen.getByText('TEACHER DASHBOARD')).toBeInTheDocument());
  });

  it('NOT_APPROVED entitlement is redirected to plans', async () => {
    setUser(teacher('APPROVED'));
    mApi.getMySubscription.mockResolvedValue({
      subscription: null,
      accessState: 'NOT_APPROVED',
    } as never);
    renderGuardAt('/teacher/dashboard');
    expect(await screen.findByText('PLANS PAGE')).toBeInTheDocument();
    expect(screen.queryByText('TEACHER DASHBOARD')).not.toBeInTheDocument();
  });
});

describe('teacher lifecycle pages', () => {
  it('4. pending-review page renders', () => {
    render(<MemoryRouter><TeacherPendingReviewPage /></MemoryRouter>);
    expect(screen.getByText('auth:teacherPendingTitle')).toBeInTheDocument();
  });

  it('5. rejected page renders', () => {
    render(<MemoryRouter><TeacherRejectedPage /></MemoryRouter>);
    expect(screen.getByText('auth:teacherRejectedTitle')).toBeInTheDocument();
  });
});
