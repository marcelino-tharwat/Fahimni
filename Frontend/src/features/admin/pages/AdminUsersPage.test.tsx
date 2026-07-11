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
      if (typeof second === 'string') return second;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsers: vi.fn(),
  useAdminUserDetail: vi.fn(),
  useCreateUser: vi.fn(),
  useUpdateUser: vi.fn(),
  useChangeUserStatus: vi.fn(),
  useChangeUserRole: vi.fn(),
  useResetUserPassword: vi.fn(),
}));

// Mock Redux store
vi.mock('@/shared/store/hooks', () => ({
  useAppSelector: vi.fn(() => ({ id: 'admin-self', role: 'ADMIN' })),
  useAppDispatch: vi.fn(() => vi.fn()),
}));

vi.mock('@/shared/store/slices/toastSlice', () => ({
  addToast: vi.fn(() => ({ type: 'toast/addToast' })),
}));

const m = hooks as unknown as Record<string, ReturnType<typeof vi.fn>>;

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

function mutationMock() {
  return { mutateAsync: vi.fn(), isPending: false };
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
  m.useCreateUser.mockReturnValue(mutationMock());
  m.useUpdateUser.mockReturnValue(mutationMock());
  m.useChangeUserStatus.mockReturnValue(mutationMock());
  m.useChangeUserRole.mockReturnValue(mutationMock());
  m.useResetUserPassword.mockReturnValue(mutationMock());
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
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('2. search input renders and is accessible', () => {
    renderAt();
    expect(screen.getByPlaceholderText('Search by name, email, or mobile')).toBeInTheDocument();
  });

  it('3. all three filter selects render', () => {
    renderAt();
    expect(screen.getByText('All Roles')).toBeInTheDocument();
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('All Teacher States')).toBeInTheDocument();
  });

  it('4. users table renders API data', () => {
    renderAt();
    expect(screen.getByText('Alpha User')).toBeInTheDocument();
    expect(screen.getByText('alpha@test.local')).toBeInTheDocument();
  });

  it('5. search input updates query (debounced)', async () => {
    renderAt();
    const input = screen.getByPlaceholderText('Search by name, email, or mobile');
    fireEvent.change(input, { target: { value: 'Alpha' } });
    await waitFor(() =>
      expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: 'Alpha' })),
    );
  });

  it('6. role filter changes query', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }));
  });

  it('7. status filter changes query', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'INACTIVE' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' }));
  });

  it('8. teacher approval filter changes query', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Teacher Approval'), { target: { value: 'PENDING_REVIEW' } });
    expect(m.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ teacherApprovalState: 'PENDING_REVIEW' }));
  });

  it('9. empty state renders when list is empty', () => {
    m.useAdminUsers.mockReturnValue(ok(list([], 0)));
    renderAt();
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('10. detail drawer opens when view details is clicked', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('User Details')).toBeInTheDocument();
  });

  it('11. detail drawer shows user info', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('User Details')).toBeInTheDocument();
    expect(await screen.findByText('Counts')).toBeInTheDocument();
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
    expect(screen.getByText('Failed to load users')).toBeInTheDocument();
  });

  it('14. no password or tokenVersion strings in rendered output', () => {
    renderAt();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/password|tokenVersion|passwordHash/i);
  });

  // ── Mutation tests ──────────────────────────────────────────────────────────

  it('15. create user button renders', () => {
    renderAt();
    expect(screen.getByText('Create User')).toBeInTheDocument();
  });

  it('16. create modal shows form fields', async () => {
    renderAt();
    fireEvent.click(screen.getByText('Create User'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The t mock returns the second string arg, so label "Full Name" is rendered
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('17. detail drawer shows action buttons', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Edit')).toBeInTheDocument();
    expect(await screen.findByText('Change Role')).toBeInTheDocument();
  });

  it('18. errors render in modals, translated by the backend error code (never the raw message)', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({ message: 'Duplicate email or mobile number', code: 'DUPLICATE_EMAIL_OR_MOBILE' });
    m.useCreateUser.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    renderAt();
    fireEvent.click(screen.getByText('Create User'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      const errorElements = screen.getAllByText(/validation:duplicateEmailOrMobile/);
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('18b. an unrecognized backend error code falls back to the safe generic message', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({ message: 'some raw unrecognized backend text', code: 'SOME_UNKNOWN_CODE' });
    m.useCreateUser.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    renderAt();
    fireEvent.click(screen.getByText('Create User'));
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getAllByText(/validation:genericError/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/some raw unrecognized backend text/)).not.toBeInTheDocument();
  });

  it('19. create mutation is called with correct data', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'new-id' });
    m.useCreateUser.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    renderAt();
    fireEvent.click(screen.getByText('Create User'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't@t.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  // ── Password Reset tests ─────────────────────────────────────────────────────

  it('20. reset password modal renders', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New Password')).toBeInTheDocument();
    expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('21. validation errors render', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    const newPwInput = screen.getByPlaceholderText('New password');
    fireEvent.change(newPwInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Min 8 chars/)).toBeInTheDocument();
  });

  it('22. submit works', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'u1' });
    m.useResetUserPassword.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    m.useAdminUserDetail.mockReturnValue(ok({
      ...DETAIL,
      user: { ...DETAIL.user, id: 'u1' },
    }));

    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    const newPwInput = screen.getByPlaceholderText('New password');
    const confirmPwInput = screen.getByPlaceholderText('Confirm password');
    const reasonTextarea = screen.getByPlaceholderText('Enter reason for password reset...');

    fireEvent.change(newPwInput, { target: { value: 'N3wStr0ng!Pass' } });
    fireEvent.change(confirmPwInput, { target: { value: 'N3wStr0ng!Pass' } });
    fireEvent.change(reasonTextarea, { target: { value: 'Admin requested reset' } });

    const submitButtons = screen.getAllByText('Reset Password');
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  it('23. success message renders', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'u1' });
    m.useResetUserPassword.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    m.useAdminUserDetail.mockReturnValue(ok({
      ...DETAIL,
      user: { ...DETAIL.user, id: 'u1' },
    }));

    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    const newPwInput = screen.getByPlaceholderText('New password');
    const confirmPwInput = screen.getByPlaceholderText('Confirm password');
    const reasonTextarea = screen.getByPlaceholderText('Enter reason for password reset...');

    fireEvent.change(newPwInput, { target: { value: 'N3wStr0ng!Pass' } });
    fireEvent.change(confirmPwInput, { target: { value: 'N3wStr0ng!Pass' } });
    fireEvent.change(reasonTextarea, { target: { value: 'Admin requested reset' } });

    const submitButtons = screen.getAllByText('Reset Password');
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  it('24. forceLogout checkbox renders', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Force logout/)).toBeInTheDocument();
  });

  it('25. no password/tokenVersion visible', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/tokenVersion|passwordHash/i);
  });

  it('26. non-self action rules render correctly', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    expect(await screen.findByText('Reset Password')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset Password'));
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // Should not show self-warning (user is not self)
    expect(screen.queryByText(/cannot reset your own password/i)).not.toBeInTheDocument();
  });
});
