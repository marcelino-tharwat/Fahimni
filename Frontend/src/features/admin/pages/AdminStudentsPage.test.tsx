// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminStudentsPage } from './AdminStudentsPage';
import * as hooks from '@/features/admin/hooks/useAdminStudents';
import type {
  AdminStudentListItem, Paginated, AdminStudentDetail,
  StudentEnrollmentItem, StudentPayments, StudentLearningSummary,
} from '@/features/admin/types/students';

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

vi.mock('@/features/admin/hooks/useAdminStudents', () => ({
  useAdminStudents: vi.fn(),
  useAdminStudentDetail: vi.fn(),
  useAdminStudentEnrollments: vi.fn(),
  useAdminStudentPayments: vi.fn(),
  useAdminStudentLearning: vi.fn(),
  useAdminUpdateStudent: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null })),
}));

vi.mock('@/features/admin/components/students/EditStudentModal', () => ({
  EditStudentModal: () => null,
}));

vi.mock('@/features/admin/api/adminStages', () => ({
  adminStagesApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));

const m = hooks as unknown as Record<string, ReturnType<typeof vi.fn>>;

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

function student(overrides: Partial<AdminStudentListItem> = {}): AdminStudentListItem {
  return {
    id: 's1', fullName: 'Alpha Student', email: 'a@x.local', mobile: '01000000001', status: 'ACTIVE',
    enrollmentsCount: 2, activeEnrollmentsCount: 1, pendingEnrollmentsCount: 1, teachersCount: 2,
    pendingPaymentsCount: 0,
    teachers: [{ id: 't1', fullName: 'Math T', subject: 'Math' }, { id: 't2', fullName: 'Phys T', subject: 'Physics' }],
    latestEnrollmentAt: '2026-06-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function list(items: AdminStudentListItem[], total = items.length): Paginated<AdminStudentListItem> {
  return { data: items, meta: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } };
}

const DETAIL: AdminStudentDetail = {
  student: { id: 's1', fullName: 'Alpha Student', email: 'a@x.local', mobile: '01000000001', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', stage: { id: 'st1', name: 'Stage 1', nameAr: 'المرحلة الأولى', nameEn: 'Stage 1' } },
  summary: { enrollmentsCount: 2, activeEnrollmentsCount: 1, pendingEnrollmentsCount: 1, teachersCount: 2, quizAttemptsCount: 4, averageScore: 82, completedLessonsCount: 6, confirmedPayments: 1, pendingPayments: 1, failedPayments: 0 },
  teachers: [{ id: 't1', fullName: 'Math T', subject: 'Math' }, { id: 't2', fullName: 'Phys T', subject: 'Physics' }],
};
const ENROLLMENTS: Paginated<StudentEnrollmentItem> = {
  data: [{ id: 'e1', status: 'ACTIVE', price: 100, paymentMethod: 'PAYMOB', createdAt: '2026-01-01T00:00:00.000Z', enrolledAt: '2026-01-01T00:00:00.000Z', chapter: { id: 'c1', name: 'Chapter A' }, stage: { id: 'st1', name: 'Stage 1' }, teacher: { id: 't1', fullName: 'Math T', subject: 'Math' } }],
  meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
};
const PAYMENTS: StudentPayments = {
  data: [{ id: 'p1', amount: 100, currency: 'EGP', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00.000Z', chapter: { id: 'c1', name: 'Chapter A' }, teacher: { id: 't1', fullName: 'Math T' } }],
  summary: { confirmed: 1, pending: 0, failed: 0, confirmedTotal: 100, currency: 'EGP' },
};
const LEARNING: StudentLearningSummary = { quizAttemptsCount: 4, completedQuizAttemptsCount: 3, averageScore: 82, lessonProgressCount: 8, completedLessonsCount: 6, lastActivityAt: '2026-06-01T00:00:00.000Z' };

function primeList(data = list([student()])) {
  m.useAdminStudents.mockReturnValue(ok(data));
  m.useAdminStudentDetail.mockReturnValue(ok(DETAIL));
  m.useAdminStudentEnrollments.mockReturnValue(ok(ENROLLMENTS));
  m.useAdminStudentPayments.mockReturnValue(ok(PAYMENTS));
  m.useAdminStudentLearning.mockReturnValue(ok(LEARNING));
}

function renderAt(path = '/admin/students') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/students" element={<AdminStudentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); primeList(); });
afterEach(() => cleanup());

describe('AdminStudentsPage', () => {
  it('1. renders the students page title', () => {
    renderAt();
    expect(screen.getByText('adminStudents.title')).toBeInTheDocument();
  });

  it('2. reads the filter from the URL (without_active_teacher tab selected)', () => {
    renderAt('/admin/students?filter=without_active_teacher');
    const tab = screen.getByRole('tab', { name: 'adminStudents.tabs.without_active_teacher' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    // The hook is called with the URL filter.
    expect(m.useAdminStudents).toHaveBeenCalledWith(expect.objectContaining({ filter: 'without_active_teacher' }));
  });

  it('3. renders all five tabs', () => {
    renderAt();
    for (const f of ['all', 'active', 'without_enrollment', 'without_active_teacher', 'payment_pending']) {
      expect(screen.getByRole('tab', { name: `adminStudents.tabs.${f}` })).toBeInTheDocument();
    }
  });

  it('4. search input updates the query (debounced)', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('adminStudents.searchPlaceholder'), { target: { value: 'Alpha' } });
    await waitFor(() =>
      expect(m.useAdminStudents).toHaveBeenCalledWith(expect.objectContaining({ q: 'Alpha' })),
    );
  });

  it('5. renders API data in the table (name + teachers)', () => {
    renderAt();
    expect(screen.getByText('Alpha Student')).toBeInTheDocument();
    expect(screen.getByText('Math T')).toBeInTheDocument();
    expect(screen.getByText('Phys T')).toBeInTheDocument();
  });

  it('6. without_enrollment empty state renders when list is empty', () => {
    m.useAdminStudents.mockReturnValue(ok(list([], 0)));
    renderAt('/admin/students?filter=without_enrollment');
    expect(screen.getByText('adminStudents.emptyTitle')).toBeInTheDocument();
  });

  it('7. without_active_teacher tab renders its rows', () => {
    m.useAdminStudents.mockReturnValue(ok(list([student({ id: 's2', fullName: 'Pending Student', activeEnrollmentsCount: 0, pendingEnrollmentsCount: 1, teachersCount: 0, teachers: [] })])));
    renderAt('/admin/students?filter=without_active_teacher');
    expect(screen.getByText('Pending Student')).toBeInTheDocument();
  });

  it('8. payment_pending tab renders', () => {
    renderAt('/admin/students?filter=payment_pending');
    expect(screen.getByRole('tab', { name: 'adminStudents.tabs.payment_pending' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Alpha Student')).toBeInTheDocument();
  });

  it('9. student detail drawer renders when a row is opened', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /adminStudents\.viewDetails/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('adminStudents.detail.title')).toBeInTheDocument();
    expect(within(dialog).getByText('Chapter A')).toBeInTheDocument(); // enrollment
    expect(within(dialog).getByText(/100 EGP/)).toBeInTheDocument(); // payment
  });

  it('10. dashboard-style filter links open the correct filter tab', () => {
    renderAt('/admin/students?filter=without_enrollment');
    expect(screen.getByRole('tab', { name: 'adminStudents.tabs.without_enrollment' })).toHaveAttribute('aria-selected', 'true');
    expect(m.useAdminStudents).toHaveBeenCalledWith(expect.objectContaining({ filter: 'without_enrollment' }));
  });

  it('11. uses no mock data (source has no shared/mocks import)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, './AdminStudentsPage.tsx'), 'utf8');
    expect(src).not.toMatch(/shared\/mocks|mockTenant|mockStudents|mockAnalytics/);
  });

  it('12. loading and error states render', () => {
    m.useAdminStudents.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: false, refetch: vi.fn() });
    const { unmount } = renderAt();
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();

    m.useAdminStudents.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });
    renderAt();
    expect(screen.getByText('adminStudents.errorLoading')).toBeInTheDocument();
  });
});
