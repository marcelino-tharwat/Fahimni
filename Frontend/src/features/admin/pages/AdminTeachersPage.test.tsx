// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { AdminTeachersPage } from './AdminTeachersPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { useAdminTeachers } from '@/features/admin/hooks/useAdminTeachers';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import type { AdminTeacher, AdminTeachersResponse } from '@/features/admin/types/teachers';
import type { AdminStats } from '@/features/admin/types/stats';

// t returns the key (interpolating a numeric `count`); i18n.language drives the
// number locale (kept 'en' so counts render as plain ASCII digits).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown, third?: unknown) => {
      const opts = (typeof second === 'object' ? second : third) as
        | Record<string, unknown>
        | undefined;
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/features/admin/hooks/useAdminTeachers', () => ({
  useAdminTeachers: vi.fn(),
}));
vi.mock('@/features/admin/hooks/useAdminStats', () => ({
  useAdminStats: vi.fn(),
}));

const mockUseAdminTeachers = useAdminTeachers as unknown as ReturnType<typeof vi.fn>;
const mockUseAdminStats = useAdminStats as unknown as ReturnType<typeof vi.fn>;

function teacher(overrides: Partial<AdminTeacher> = {}): AdminTeacher {
  return {
    id: 't-1',
    fullName: 'Math Teacher',
    email: 'teacher.math@example.local',
    mobile: '01000000001',
    status: 'ACTIVE',
    profile: { subject: 'Mathematics', photoUrl: null },
    stats: {
      stagesCount: 2,
      chaptersCount: 5,
      lessonsCount: 20,
      quizzesCount: 4,
      studentsCount: 12,
      enrollmentsCount: 18,
      confirmedCourseRevenue: 3500,
      confirmedSubscriptionPayments: 199,
      monthlyConfirmedCourseRevenue: 500,
      aiUsage: 7,
    },
    currentSubscription: {
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      plan: { code: 'PRO', name: 'pro', displayName: 'Pro Plan' },
    },
    pendingSubscriptionPayment: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function loaded(data: AdminTeachersResponse) {
  mockUseAdminTeachers.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTeachersPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('AdminTeachersPage', () => {
  it('1. renders the page title', () => {
    loaded({ data: [teacher()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(screen.getByText('adminTeachers.title')).toBeInTheDocument();
  });

  it('2. renders search box and status filters', () => {
    loaded({ data: [teacher()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(screen.getByLabelText('adminTeachers.searchPlaceholder')).toBeInTheDocument();
    // Status filter buttons (ALL/ACTIVE/INACTIVE/BANNED) — scoped to the filter
    // group so the row's own status badge doesn't collide.
    const group = screen.getByRole('group', { name: 'adminTeachers.statusFilter' });
    expect(within(group).getByText('adminTeachers.status.ALL')).toBeInTheDocument();
    expect(within(group).getByText('adminTeachers.status.ACTIVE')).toBeInTheDocument();
    expect(within(group).getByText('adminTeachers.status.INACTIVE')).toBeInTheDocument();
    expect(within(group).getByText('adminTeachers.status.BANNED')).toBeInTheDocument();
  });

  it('3. renders API data in the table (name, students, course revenue, plan)', () => {
    loaded({
      data: [teacher({ fullName: 'Physics Teacher', stats: { ...teacher().stats, studentsCount: 9 } })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Physics Teacher')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument(); // studentsCount
    expect(screen.getByText('Pro Plan')).toBeInTheDocument(); // current plan
    // Two distinct money values (course revenue vs subscription payment) — kept separate.
    expect(screen.getByText(/3,?500/)).toBeInTheDocument();
    expect(screen.getByText(/199/)).toBeInTheDocument();
  });

  it('shows a pending-payment badge only when a pending payment exists', () => {
    loaded({
      data: [
        teacher({
          id: 't-pending',
          fullName: 'Chem Teacher',
          pendingSubscriptionPayment: {
            amount: 555,
            currency: 'EGP',
            billingInterval: 'MONTHLY',
            createdAt: '2026-07-01T00:00:00.000Z',
            plan: { code: 'PRO', displayName: 'Pro Plan' },
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('adminTeachers.pendingPayment')).toBeInTheDocument();
  });

  it('4. renders the empty state when there are no teachers', () => {
    loaded({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderPage();
    expect(screen.getByText('adminTeachers.emptyTitle')).toBeInTheDocument();
  });

  it('5. view details link points to /admin/teachers/:teacherId', () => {
    loaded({ data: [teacher({ id: 'teacher-xyz' })], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    renderPage();
    const link = screen.getByRole('link', { name: /adminTeachers\.viewDetails/ });
    expect(link).toHaveAttribute('href', '/admin/teachers/teacher-xyz');
  });

  it('6. the page uses no Tenants mock data', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, './AdminTeachersPage.tsx'), 'utf8');
    expect(src).not.toMatch(/shared\/mocks/);
    expect(src).not.toMatch(/mockTenant|mockAnalytics|mockStudents/);
  });
});

describe('AdminDashboardPage top-teacher links', () => {
  const stats: AdminStats = {
    users: { totalTeachers: 1, activeTeachers: 1, totalStudents: 0, activeStudents: 0, studentsWithoutTeacher: 0, studentsWithoutAnyEnrollment: 0 },
    content: { totalStages: 0, totalChapters: 0, totalLessons: 0, totalMaterials: 0, totalQuizzes: 0, publishedQuizzes: 0, draftQuizzes: 0 },
    learning: { totalEnrollments: 0, activeEnrollments: 0, pendingEnrollments: 0, quizAttempts: 0, averageQuizScore: 0 },
    finance: { confirmedCourseRevenue: 0, confirmedTeacherSubscriptionRevenue: 0, totalConfirmedRevenue: 0, monthlyConfirmedRevenue: 0, estimatedSubscriptionRevenue: 0, currency: 'EGP', reliabilityWarnings: [] },
    operations: { pendingTeacherRequests: 0, activeTeacherSubscriptions: 0, pendingTeacherSubscriptionRequests: 0, pendingTeacherSubscriptionPayments: 0, failedTeacherSubscriptionPayments: 0 },
    ai: { quizGenerations: 0, essayGrading: 0, totalAiEvents: 0 },
    topTeachers: {
      byRevenue: [{ teacherId: 'teacher-abc', fullName: 'Top Revenue Teacher', revenue: 9000 }],
      byStudents: [{ teacherId: 'teacher-def', fullName: 'Top Students Teacher', studentCount: 40 }],
    },
  };

  it('7. dashboard top-teacher links resolve to the /admin/teachers/:teacherId route pattern', () => {
    mockUseAdminStats.mockReturnValue({ data: stats, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false });
    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );
    const revenueRow = screen.getByText('Top Revenue Teacher').closest('tr') as HTMLElement;
    expect(within(revenueRow).getByRole('link')).toHaveAttribute('href', '/admin/teachers/teacher-abc');
    const studentsRow = screen.getByText('Top Students Teacher').closest('tr') as HTMLElement;
    expect(within(studentsRow).getByRole('link')).toHaveAttribute('href', '/admin/teachers/teacher-def');
  });
});
