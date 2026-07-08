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
  users: { totalTeachers: 3, activeTeachers: 2, totalStudents: 10, activeStudents: 8, studentsWithoutTeacher: 4, studentsWithoutAnyEnrollment: 2 },
  content: { totalStages: 2, totalChapters: 5, totalLessons: 20, totalMaterials: 7, totalQuizzes: 6, publishedQuizzes: 4, draftQuizzes: 2 },
  learning: { totalEnrollments: 15, activeEnrollments: 12, pendingEnrollments: 3, quizAttempts: 40, averageQuizScore: 72.5 },
  finance: {
    confirmedCourseRevenue: 8000, confirmedTeacherSubscriptionRevenue: 2000, totalConfirmedRevenue: 10000,
    monthlyConfirmedRevenue: 1200, estimatedSubscriptionRevenue: 0,
    currency: 'EGP', reliabilityWarnings: ['تحذير تجريبي حول الإيرادات'],
  },
  operations: { pendingTeacherRequests: 2, activeTeacherSubscriptions: 1, pendingTeacherSubscriptionRequests: 1, pendingTeacherSubscriptionPayments: 3, failedTeacherSubscriptionPayments: 1 },
  ai: { quizGenerations: 12, essayGrading: 7, totalAiEvents: 19 },
  topTeachers: {
    byRevenue: [{ teacherId: 't1', fullName: 'Ahmed Revenue', revenue: 8000 }],
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

function loaded() {
  mockUseAdminStats.mockReturnValue({ isLoading: false, isError: false, data: SAMPLE, refetch: vi.fn(), isFetching: false });
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

  it('2. renders the stats sections', () => {
    loaded();
    renderPage();
    expect(screen.getByText('adminDashboard.title')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.usersSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.financeSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.operationsSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.aiSection')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.totalAiEvents')).toBeInTheDocument();
  });

  it('3. renders the students-without-teacher card (without_active_teacher link)', () => {
    loaded();
    const { container } = renderPage();
    expect(screen.getByText('adminDashboard.studentsWithoutTeacher')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/students?filter=without_active_teacher"]')).not.toBeNull();
  });

  it('4. renders the students-without-any-enrollment card', () => {
    loaded();
    const { container } = renderPage();
    expect(screen.getByText('adminDashboard.studentsWithoutAnyEnrollment')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/students?filter=without_enrollment"]')).not.toBeNull();
  });

  it('5. renders the revenue cards (total + course) linking revenue to /admin/revenue', () => {
    loaded();
    const { container } = renderPage();
    expect(screen.getByText('adminDashboard.totalConfirmedRevenue')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.confirmedCourseRevenue')).toBeInTheDocument();
    expect(screen.getByText('adminDashboard.monthlyConfirmedRevenue')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/revenue"]')).not.toBeNull();
  });

  it('6. renders the teacher subscription revenue card', () => {
    loaded();
    renderPage();
    expect(screen.getByText('adminDashboard.confirmedTeacherSubscriptionRevenue')).toBeInTheDocument();
  });

  it('renders pending subscription payments card linking to /admin/subscriptions', () => {
    loaded();
    const { container } = renderPage();
    expect(screen.getByText('adminDashboard.pendingTeacherSubscriptionPayments')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/subscriptions"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/teacher-requests"]')).not.toBeNull();
  });

  it('7. renders revenue reliability warnings', () => {
    loaded();
    renderPage();
    expect(screen.getByText('adminDashboard.reliabilityTitle')).toBeInTheDocument();
    expect(screen.getByText('تحذير تجريبي حول الإيرادات')).toBeInTheDocument();
  });

  it('8. renders top teachers with detail links', () => {
    loaded();
    const { container } = renderPage();
    expect(screen.getByText('Ahmed Revenue')).toBeInTheDocument();
    expect(screen.getByText('Sara Students')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/teachers/t1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/teachers/t2"]')).not.toBeNull();
  });
});

describe('AdminDashboardPage — source guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(resolve(here, './AdminDashboardPage.tsx'), 'utf8');
  const router = readFileSync(resolve(here, '../../../app/router.tsx'), 'utf8');

  it('9. uses the real API hook and contains no mock data', () => {
    expect(page).toContain('useAdminStats');
    expect(page).not.toMatch(/@\/shared\/mocks|mockStats|fakeStats|dummyStats/);
  });

  it('10. the /admin/dashboard route is admin-only (super_admin RoleGuard)', () => {
    expect(router).toContain("allowedRoles={['super_admin']}");
    expect(router).toContain("path: '/admin/dashboard'");
  });
});
