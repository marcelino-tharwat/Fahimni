// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminUsersPage } from './AdminUsersPage';
import * as hooks from '@/features/admin/hooks/useAdminUsers';
import type { AdminUsersResponse, AdminUserDetailResponse, AdminUserListItem } from '@/features/admin/types/users';

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

vi.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsers: vi.fn(),
  useAdminUserDetail: vi.fn(),
}));

const m = hooks as unknown as Record<string, ReturnType<typeof vi.fn>>;

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

function userItem(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id: 'u1',
    fullName: 'Alpha User',
    email: 'alpha@test.local',
    mobile: '01000000001',
    role: 'STUDENT',
    status: 'ACTIVE',
    teacherApprovalState: 'NONE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    profiles: { student: true, teacher: false },
    ...overrides,
  };
}

function list(items: AdminUserListItem[], total = items.length): AdminUsersResponse {
  return { data: items, meta: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } };
}

const DETAIL: AdminUserDetailResponse = {
  user: {
    id: 'u1', fullName: 'Alpha User', email: 'alpha@test.local', mobile: '01000000001',
    role: 'STUDENT', status: 'ACTIVE', teacherApprovalState: 'NONE',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    profiles: { student: true, teacher: false },
  },
  studentProfile: null,
  teacherProfile: null,
  counts: { enrollmentsCount: 2, quizAttemptsCount: 4, paymentTransactionsCount: 1, teacherStagesCount: 0, teacherSubscriptionsCount: 0 },
  recentAuditLogs: [{ id: 'log1', action: 'USER_LISTED', resourceType: 'User', createdAt: '2026-01-02T00:00:00.000Z' }],
};

function primeList(data = list([userItem()])) {
  m.useAdminUsers.mockReturnValue(ok(data));
  m.useAdminUserDetail.mockReturnValue(ok(DETAIL));
}

function renderAt(path = '/admin/users') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); primeList(); });
afterEach(() => cleanup());

describe('AdminUsersPage', () => {
  it('1. renders the page title', () => {
    renderAt();
    expect(screen.getByText('adminUsers.title')).toBeInTheDocument();
  });

  it('2. search input renders and is accessible', () => {
    renderAt();
    expect(screen.getByLabelText('adminUsers.searchPlaceholder')).toBeInTheDocument();
  });

  it('3. all three filter selects render', () => {
    renderAt();
    expect(screen.getByLabelText('adminUsers.filterRole')).toBeInTheDocument();
    expect(screen.getByLabelText('adminUsers.filterStatus')).toBeInTheDocument();
    expect(screen.getByLabelText('adminUsers.filterTeacherApproval')).toBeInTheDocument();
  });

  it('4. users table renders API data', () => {
    renderAt();
    expect(screen.getByText('Alpha User')).toBeInTheDocument();
    expect(screen.getByText('alpha@test.local')).toBeInTheDocument();
  });

  it('5. search input updates query (debounced)', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('adminUsers.searchPlaceholder'), { target: { value: 'Alpha' } });
    await waitFor(() =>
      expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: 'Alpha' })),
    );
  });

  it('6. role filter changes query', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('adminUsers.filterRole'), { target: { value: 'ADMIN' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }));
  });

  it('7. status filter changes query', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('adminUsers.filterStatus'), { target: { value: 'INACTIVE' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' }));
  });

  it('8. teacher approval filter changes query', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('adminUsers.filterTeacherApproval'), { target: { value: 'PENDING_REVIEW' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ teacherApprovalState: 'PENDING_REVIEW' }));
  });

  it('9. empty state renders when list is empty', () => {
    m.useAdminUsers.mockReturnValue(ok(list([], 0)));
    renderAt();
    expect(screen.getByText('adminUsers.emptyTitle')).toBeInTheDocument();
  });

  it('10. detail drawer opens when view details is clicked', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /adminUsers\.viewDetails/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('adminUsers.detail.title')).toBeInTheDocument();
  });

  it('11. detail drawer shows user info', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /adminUsers\.viewDetails/ }));
    expect(await screen.findByText('adminUsers.detail.title')).toBeInTheDocument();
    expect(await screen.findByText('adminUsers.detail.counts')).toBeInTheDocument();
  });

  it('12. uses no mock data (source has no shared/mocks import)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, './AdminUsersPage.tsx'), 'utf8');
    expect(src).not.toMatch(/shared\/mocks|mockTenant|mockStudents|mockAnalytics/);
  });

  it('13. loading and error states render', () => {
    m.useAdminUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: false, refetch: vi.fn() });
    const { unmount } = renderAt();
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();

    m.useAdminUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });
    renderAt();
    expect(screen.getByText('adminUsers.errorLoading')).toBeInTheDocument();
  });

  it('14. no password or tokenVersion strings in rendered output', () => {
    renderAt();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/password|tokenVersion|passwordHash/i);
  });
});
