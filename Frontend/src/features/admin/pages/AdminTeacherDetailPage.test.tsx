// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminTeacherDetailPage } from './AdminTeacherDetailPage';
import { AdminTeachersPage } from './AdminTeachersPage';
import * as detailHooks from '@/features/admin/hooks/useAdminTeacherDetail';
import { useAdminTeachers } from '@/features/admin/hooks/useAdminTeachers';
import type {
  AdminTeacherDetail, Paginated, TeacherStudentItem, TeacherEnrollmentItem,
  TeacherContent, TeacherRevenue, TeacherSubscription, TeacherAiUsage,
} from '@/features/admin/types/teacherDetail';
import type { AdminTeachersResponse } from '@/features/admin/types/teachers';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown, third?: unknown) => {
      const opts = (typeof second === 'object' ? second : third) as Record<string, unknown> | undefined;
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/features/admin/hooks/useAdminTeacherDetail', () => ({
  useAdminTeacherDetail: vi.fn(),
  useAdminTeacherStudents: vi.fn(),
  useAdminTeacherEnrollments: vi.fn(),
  useAdminTeacherContent: vi.fn(),
  useAdminTeacherRevenue: vi.fn(),
  useAdminTeacherSubscription: vi.fn(),
  useAdminTeacherAiUsage: vi.fn(),
}));
vi.mock('@/features/admin/hooks/useAdminTeachers', () => ({ useAdminTeachers: vi.fn() }));

const mocked = detailHooks as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockTeachersList = useAdminTeachers as unknown as ReturnType<typeof vi.fn>;

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

const DETAIL: AdminTeacherDetail = {
  teacher: { id: 't-1', fullName: 'Math Teacher', email: 'm@x.local', mobile: '01000000001', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z' },
  profile: { subject: 'Math', bio: 'Bio here', photoUrl: null },
  stats: { stagesCount: 2, chaptersCount: 5, lessonsCount: 20, quizzesCount: 4, studentsCount: 12, enrollmentsCount: 18, activeEnrollmentsCount: 15, pendingEnrollmentsCount: 3, aiUsage: 7 },
  currentSubscription: { status: 'ACTIVE', billingInterval: 'MONTHLY', currentPeriodEnd: '2026-08-01T00:00:00.000Z', plan: { code: 'PRO', name: 'pro', displayName: 'Pro Plan' } },
  pendingSubscriptionPayment: { id: 'p1', amount: 199, currency: 'EGP', billingInterval: 'MONTHLY', status: 'PENDING', createdAt: '2026-07-01T00:00:00.000Z', plan: { code: 'PRO', displayName: 'Pro Plan' } },
  revenue: { confirmedCourseRevenue: 3500, monthlyConfirmedCourseRevenue: 500, confirmedSubscriptionPayments: 199, currency: 'EGP' },
};

const STUDENTS: Paginated<TeacherStudentItem> = {
  data: [{ id: 's1', fullName: 'Student One', email: 's1@x.local', mobile: '01000000002', status: 'ACTIVE', enrollmentsCount: 2, activeEnrollmentsCount: 2, pendingEnrollmentsCount: 0, enrollments: [{ id: 'e1', status: 'ACTIVE', price: 100, paymentMethod: 'PAYMOB', enrolledAt: '2026-01-01T00:00:00.000Z', chapter: { id: 'c1', name: 'Chapter A', stageId: 'st1', stageName: 'Stage 1' } }] }],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};
const ENROLLMENTS: Paginated<TeacherEnrollmentItem> = {
  data: [{ id: 'e1', status: 'ACTIVE', price: 100, paymentMethod: 'PAYMOB', enrolledAt: '2026-01-01T00:00:00.000Z', student: { id: 's1', fullName: 'Student One', email: 's1@x.local' }, chapter: { id: 'c1', name: 'Chapter A', stageId: 'st1', stageName: 'Stage 1' } }],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};
const CONTENT: TeacherContent = {
  counts: { stagesCount: 2, chaptersCount: 5, lessonsCount: 20, quizzesCount: 4, publishedQuizzesCount: 3, draftQuizzesCount: 1 },
  stages: [{ id: 'st1', name: 'Stage 1', chaptersCount: 1, chapters: [{ id: 'c1', name: 'Chapter A', lessonsCount: 4, quizzesCount: 2 }] }],
};
const REVENUE: TeacherRevenue = {
  currency: 'EGP', confirmedCourseRevenue: 3500, monthlyConfirmedCourseRevenue: 500,
  coursePayments: { successCount: 3, pendingCount: 1, failedCount: 0, recent: [{ id: 'pay1', amount: 1200, currency: 'EGP', status: 'SUCCESS', createdAt: '2026-06-01T00:00:00.000Z', student: { id: 's1', fullName: 'Student One' }, chapter: { id: 'c1', name: 'Chapter A' } }] },
  subscriptionPayments: { confirmedTotal: 199, successCount: 1, pendingCount: 1, failedCount: 0 },
};
const SUBSCRIPTION: TeacherSubscription = {
  currentSubscription: DETAIL.currentSubscription,
  pendingPayment: DETAIL.pendingSubscriptionPayment,
  latestSuccessfulPayments: [{ id: 'sp1', amount: 199, currency: 'EGP', billingInterval: 'MONTHLY', status: 'SUCCESS', createdAt: '2026-05-01T00:00:00.000Z', plan: { code: 'PRO', displayName: 'Pro Plan' } }],
  failedPaymentsCount: 0,
};
const AI: TeacherAiUsage = {
  byType: [{ type: 'AI_QUIZ_GENERATION', events: 5, units: 5 }, { type: 'AI_ESSAY_GRADING', events: 2, units: 2 }],
  totalEvents: 7, totalUnits: 7, currentMonth: { events: 3, units: 3 },
};

function primeAll() {
  mocked.useAdminTeacherDetail.mockReturnValue(ok(DETAIL));
  mocked.useAdminTeacherStudents.mockReturnValue(ok(STUDENTS));
  mocked.useAdminTeacherEnrollments.mockReturnValue(ok(ENROLLMENTS));
  mocked.useAdminTeacherContent.mockReturnValue(ok(CONTENT));
  mocked.useAdminTeacherRevenue.mockReturnValue(ok(REVENUE));
  mocked.useAdminTeacherSubscription.mockReturnValue(ok(SUBSCRIPTION));
  mocked.useAdminTeacherAiUsage.mockReturnValue(ok(AI));
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/admin/teachers/t-1']}>
      <Routes>
        <Route path="/admin/teachers/:teacherId" element={<AdminTeacherDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const clickTab = (key: string) =>
  fireEvent.click(screen.getByRole('tab', { name: `adminTeacherDetail.tabs.${key}` }));

beforeEach(() => { vi.clearAllMocks(); primeAll(); });
afterEach(() => cleanup());

describe('AdminTeacherDetailPage', () => {
  it('1. renders the detail page (teacher header)', () => {
    renderDetail();
    expect(screen.getByText('Math Teacher')).toBeInTheDocument();
    // Revenue separation: both labelled figures present in the header.
    expect(screen.getAllByText('adminTeacherDetail.tabs.courseRevenue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('adminTeacherDetail.tabs.subscription').length).toBeGreaterThan(0);
  });

  it('2. renders the back link to /admin/teachers', () => {
    renderDetail();
    const link = screen.getByRole('link', { name: /adminTeacherDetail\.back/ });
    expect(link).toHaveAttribute('href', '/admin/teachers');
  });

  it('3. renders all six tabs', () => {
    renderDetail();
    for (const key of ['students', 'enrollments', 'content', 'courseRevenue', 'subscription', 'aiUsage']) {
      expect(screen.getByRole('tab', { name: `adminTeacherDetail.tabs.${key}` })).toBeInTheDocument();
    }
  });

  it('4. students tab renders (default)', () => {
    renderDetail();
    expect(screen.getByText('Student One')).toBeInTheDocument();
  });

  it('5. enrollments tab renders', () => {
    renderDetail();
    clickTab('enrollments');
    expect(screen.getByText('Chapter A')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'adminTeacherDetail.enrollments.filter' })).toBeInTheDocument();
  });

  it('6. content tab renders', () => {
    renderDetail();
    clickTab('content');
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
  });

  it('7. course revenue tab renders', () => {
    renderDetail();
    clickTab('courseRevenue');
    expect(screen.getByText('adminTeacherDetail.courseRevenue.note')).toBeInTheDocument();
    // 3,500 appears in both the header figure and this tab — assert at least one.
    expect(screen.getAllByText(/3,?500/).length).toBeGreaterThan(0);
  });

  it('8. subscription payment tab renders', () => {
    renderDetail();
    clickTab('subscription');
    expect(screen.getByText('adminTeacherDetail.subscription.note')).toBeInTheDocument();
    expect(screen.getAllByText('Pro Plan').length).toBeGreaterThan(0);
  });

  it('9. AI usage tab renders', () => {
    renderDetail();
    clickTab('aiUsage');
    expect(screen.getByText('adminTeacherDetail.aiUsage.types.AI_QUIZ_GENERATION')).toBeInTheDocument();
  });

  it('10. empty state renders (students)', () => {
    mocked.useAdminTeacherStudents.mockReturnValue(ok({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
    renderDetail();
    expect(screen.getByText('adminTeacherDetail.students.empty')).toBeInTheDocument();
  });

  it('11. error state renders when the detail query errors', () => {
    mocked.useAdminTeacherDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });
    renderDetail();
    expect(screen.getByText('adminTeacherDetail.error')).toBeInTheDocument();
  });
});

describe('AdminTeachers list → detail navigation', () => {
  it('12. /admin/teachers view-details links point to /admin/teachers/:teacherId', () => {
    const list: AdminTeachersResponse = {
      data: [{
        id: 'teacher-xyz', fullName: 'Nav Teacher', email: 'n@x.local', mobile: '01000000009', status: 'ACTIVE',
        profile: { subject: null, photoUrl: null },
        stats: { stagesCount: 0, chaptersCount: 0, lessonsCount: 0, quizzesCount: 0, studentsCount: 0, enrollmentsCount: 0, confirmedCourseRevenue: 0, confirmedSubscriptionPayments: 0, monthlyConfirmedCourseRevenue: 0, aiUsage: 0 },
        currentSubscription: null, pendingSubscriptionPayment: null, createdAt: '2026-01-01T00:00:00.000Z',
      }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mockTeachersList.mockReturnValue({ data: list, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });
    render(<MemoryRouter><AdminTeachersPage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /adminTeachers\.viewDetails/ });
    expect(link).toHaveAttribute('href', '/admin/teachers/teacher-xyz');
  });
});
