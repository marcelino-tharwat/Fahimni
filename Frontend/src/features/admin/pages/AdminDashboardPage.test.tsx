// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import type { AdminStats } from '@/features/admin/types/stats';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/admin/hooks/useAdminStats', () => ({
  useAdminStats: vi.fn(),
}));

const mockUseAdminStats = useAdminStats as unknown as ReturnType<typeof vi.fn>;

const SAMPLE: AdminStats = {
  users: { totalTeachers: 3, activeTeachers: 2, totalStudents: 10, activeStudents: 8, studentsWithoutTeacher: 4 },
  content: { totalStages: 2, totalChapters: 5, totalLessons: 20, totalMaterials: 7, totalQuizzes: 6, publishedQuizzes: 4, draftQuizzes: 2 },
  learning: { totalEnrollments: 15, activeEnrollments: 12, pendingEnrollments: 3, quizAttempts: 40, averageQuizScore: 72.5 },
  finance: {
    confirmedRevenue: 1000, monthlyConfirmedRevenue: 200, estimatedSubscriptionRevenue: 500,
    currency: 'EGP', reliabilityWarnings: ['تحذير تجريبي حول الإيرادات'],
  },
  operations: { pendingTeacherRequests: 2, activeTeacherSubscriptions: 1, pendingTeacherSubscriptionRequests: 1 },
  ai: { quizGenerations: 12, essayGrading: 7 },
  topTeachers: {
    byRevenue: [{ teacherId: 't1', fullName: 'Ahmed Revenue', revenue: 1000 }],
    byStudents: [{ teacherId: 't2', fullName: 'Sara Students', studentCount: 5 }],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
}

afterEach(() => cleanup());

describe('AdminDashboardPage — rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('1. renders a loading state', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByLabelText('loading')).toBeInTheDocument();
  });

  it('renders an error state with retry', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('common:status.retry')).toBeInTheDocument();
  });

  it('2. renders the stats sections and values', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
    renderPage();
    expect(screen.getByText('adminDashboard.title')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.usersSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.financeSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.contentSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.aiSection')).toBeInTheDocument();
  });

  it('3. renders the students-without-teacher card linking to the unassigned filter', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
    const { container } = renderPage();
    expect(screen.getByText('adminDashboard.studentsWithoutTeacher')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/students?filter=unassigned"]')).not.toBeNull();
  });

  it('4. renders top teachers by revenue and by students with detail links', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
    const { container } = renderPage();
    expect(screen.getByText('Ahmed Revenue')).toBeInTheDocument();
    expect(screen.getByText('Sara Students')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/teachers/t1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/teachers/t2"]')).not.toBeNull();
  });

  it('5. renders revenue reliability warnings', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
    renderPage();
    expect(screen.getByText('adminDashboard.reliabilityTitle')).toBeInTheDocument();
    expect(screen.getByText('تحذير تجريبي حول الإيرادات')).toBeInTheDocument();
  });

  it('links revenue card to /admin/revenue and pending requests to /admin/teacher-requests', () => {
    mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
    const { container } = renderPage();
    expect(container.querySelector('a[href="/admin/revenue"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/teacher-requests"]')).not.toBeNull();
  });
});

describe('AdminDashboardPage — source guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(resolve(here, './AdminDashboardPage.tsx'), 'utf8');
  const router = readFileSync(resolve(here, '../../../app/router.tsx'), 'utf8');

  it('6. uses the real API hook and contains no mock data', () => {
    expect(page).toContain('useAdminStats');
    expect(page).not.toMatch(/@\/shared\/mocks|mockStats|fakeStats|dummyStats/);
  });

  it('7. the /admin/dashboard route is admin-only (super_admin RoleGuard)', () => {
    expect(router).toContain("allowedRoles={['super_admin']}");
    expect(router).toContain("path: '/admin/dashboard'");
  });
});
