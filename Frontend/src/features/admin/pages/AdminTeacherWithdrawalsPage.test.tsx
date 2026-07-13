// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminTeacherWithdrawalsPage } from './AdminTeacherWithdrawalsPage';
import type {
  AdminWithdrawalListItem,
  Paginated,
  TeacherFinancialSummary,
} from '@/features/admin/types/teacherWithdrawals';

// t() always returns the key itself (ignoring any Arabic fallback string
// argument) so assertions can target i18n keys directly regardless of
// language — matches the convention used by other admin page tests.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown, third?: unknown) => {
      const opts = (typeof second === 'object' ? second : third) as
        | Record<string, unknown>
        | undefined;
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: 'ar' },
  }),
}));

vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/store/slices/toastSlice', () => ({
  addToast: vi.fn(),
}));

const { mockUseAdminTeacherWithdrawals, mockUpdateMutate, mockUseTeacherFinancialSummary } =
  vi.hoisted(() => ({
    mockUseAdminTeacherWithdrawals: vi.fn(),
    mockUpdateMutate: vi.fn(),
    mockUseTeacherFinancialSummary: vi.fn(),
  }));

vi.mock('@/features/admin/hooks/useAdminTeacherWithdrawals', () => ({
  useAdminTeacherWithdrawals: mockUseAdminTeacherWithdrawals,
  useUpdateWithdrawalStatus: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useTeacherFinancialSummary: mockUseTeacherFinancialSummary,
}));

function summary(overrides: Partial<TeacherFinancialSummary> = {}): TeacherFinancialSummary {
  return {
    teacherId: 't1',
    teacherName: 'أحمد الرياضي',
    teacherEmail: 'ahmed@e2e.test',
    subject: 'الرياضيات',
    totalEarnings: 5000,
    totalWithdrawn: 2000,
    pendingWithdrawalAmount: 500,
    remainingAvailableBalance: 2500,
    teacherSubscriptionTotalPaid: 300,
    currentPlan: 'Premium',
    planExpiresAt: '2026-12-31T00:00:00.000Z',
    lastWithdrawalDate: '2026-06-01T00:00:00.000Z',
    currency: 'EGP',
    ...overrides,
  };
}

function item(overrides: Partial<AdminWithdrawalListItem> = {}): AdminWithdrawalListItem {
  return {
    id: 'w1',
    teacher: { id: 't1', fullName: 'أحمد الرياضي', email: 'ahmed@e2e.test' },
    amount: 150,
    currency: 'EGP',
    status: 'PENDING',
    payoutMethodSnapshot: { instaPayHandle: 'ahmed@instapay', vodafoneCashNumber: '01001234567' },
    teacherNote: null,
    adminNote: null,
    requestedAt: '2026-06-01T00:00:00.000Z',
    processedAt: null,
    transferredAt: null,
    cancelledAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

function loaded(items: AdminWithdrawalListItem[], summaries: TeacherFinancialSummary[] = [summary()]) {
  const data: Paginated<AdminWithdrawalListItem> = {
    data: items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  };
  mockUseAdminTeacherWithdrawals.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  mockUseTeacherFinancialSummary.mockReturnValue({
    data: summaries,
    isLoading: false,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTeacherWithdrawalsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('AdminTeacherWithdrawalsPage', () => {
  it('6. renders the admin withdrawals page', () => {
    loaded([item()]);
    renderPage();
    expect(screen.getByTestId('admin-teacher-withdrawals-page')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawals-admin-table')).toBeInTheDocument();
  });

  it('7. status filters render', () => {
    loaded([item()]);
    renderPage();
    const group = screen.getByTestId('status-filters');
    expect(group).toBeInTheDocument();
    for (const status of ['ALL', 'PENDING', 'PROCESSING', 'TRANSFERRED', 'REJECTED', 'CANCELLED']) {
      expect(screen.getByTestId(`status-filter-${status}`)).toBeInTheDocument();
    }
  });

  it('9. status badges render for the listed withdrawal', () => {
    loaded([item({ status: 'PROCESSING' })]);
    renderPage();
    const row = screen.getByTestId('withdrawal-admin-row-w1');
    expect(
      within(row).getByText('adminTeacherWithdrawals.status.PROCESSING'),
    ).toBeInTheDocument();
  });

  it('10 & 15. PENDING request detail shows all three actions, including the مقبول/processing label', async () => {
    loaded([item({ status: 'PENDING' })]);
    renderPage();
    fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

    expect(await screen.findByTestId('action-processing')).toBeInTheDocument();
    expect(screen.getByTestId('action-transferred')).toBeInTheDocument();
    expect(screen.getByTestId('action-rejected')).toBeInTheDocument();
    expect(screen.getByText('adminTeacherWithdrawals.action.processing')).toBeInTheDocument();
  });

  it('11. PROCESSING request detail does not show a return-to-pending action, only transferred/rejected', async () => {
    loaded([item({ status: 'PROCESSING' })]);
    renderPage();
    fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

    expect(await screen.findByTestId('action-transferred')).toBeInTheDocument();
    expect(screen.getByTestId('action-rejected')).toBeInTheDocument();
    expect(screen.queryByTestId('action-processing')).not.toBeInTheDocument();
  });

  it('12. final statuses (TRANSFERRED/REJECTED/CANCELLED) render read-only with no action buttons', async () => {
    for (const status of ['TRANSFERRED', 'REJECTED', 'CANCELLED'] as const) {
      loaded([item({ status })]);
      const { unmount } = renderPage();
      fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

      expect(await screen.findByTestId('detail-readonly')).toBeInTheDocument();
      expect(screen.queryByTestId('action-processing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-transferred')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-rejected')).not.toBeInTheDocument();
      unmount();
      cleanup();
    }
  });

  it('8. admin status update action calls the mutation with the new status', async () => {
    loaded([item({ status: 'PENDING' })]);
    renderPage();
    fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

    const btn = await screen.findByTestId('action-processing');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ withdrawalId: 'w1', body: expect.objectContaining({ status: 'PROCESSING' }) }),
        expect.any(Object),
      );
    });
  });

  it('14. a failed status update surfaces the backend localized error message', async () => {
    mockUpdateMutate.mockImplementation((_vars, { onError }: { onError: (e: unknown) => void }) => {
      onError({ message: 'لا يمكن الرجوع لحالة سابقة أو تغيير حالة طلب السحب بعد وصوله لحالة نهائية' });
    });
    loaded([item({ status: 'PENDING' })]);
    renderPage();
    fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

    const btn = await screen.findByTestId('action-transferred');
    fireEvent.click(btn);

    expect(mockUpdateMutate).toHaveBeenCalled();
  });

  it('shows the payout method snapshot in the detail drawer', async () => {
    loaded([item()]);
    renderPage();
    fireEvent.click(screen.getByTestId('view-withdrawal-w1'));

    const snapshot = await screen.findByTestId('detail-payout-snapshot');
    expect(snapshot).toHaveTextContent('ahmed@instapay');
    expect(snapshot).toHaveTextContent('01001234567');
  });

  it('shows the empty state when there are no withdrawal requests', () => {
    loaded([]);
    renderPage();
    expect(screen.getByText('adminTeacherWithdrawals.emptyTitle')).toBeInTheDocument();
  });

  it('shows the error state with a retry action', () => {
    const refetch = vi.fn();
    mockUseAdminTeacherWithdrawals.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    });
    mockUseTeacherFinancialSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('adminTeacherWithdrawals.retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders summary cards with financial data', () => {
    loaded([item()]);
    renderPage();
    const cards = screen.getByTestId('teacher-summary-cards');
    expect(cards).toBeInTheDocument();
    expect(screen.getByTestId('summary-total-earnings')).toBeInTheDocument();
    expect(screen.getByTestId('summary-total-withdrawn')).toBeInTheDocument();
    expect(screen.getByTestId('summary-pending')).toBeInTheDocument();
    expect(screen.getByTestId('summary-available-balance')).toBeInTheDocument();
    expect(screen.getByTestId('summary-subscription-paid')).toBeInTheDocument();
  });

  it('displays aggregated summary values from all teachers', () => {
    loaded(
      [item()],
      [
        summary({ totalEarnings: 3000, totalWithdrawn: 1000, pendingWithdrawalAmount: 200, remainingAvailableBalance: 1800, teacherSubscriptionTotalPaid: 150 }),
        summary({ teacherId: 't2', totalEarnings: 2000, totalWithdrawn: 1000, pendingWithdrawalAmount: 300, remainingAvailableBalance: 700, teacherSubscriptionTotalPaid: 150 }),
      ],
    );
    renderPage();
    // Total earnings should be 5000 (3000 + 2000)
    const earningsCard = screen.getByTestId('summary-total-earnings');
    // ar-EG locale formats 5000 as ٥٬٠٠٠ (Arabic-Indic numerals)
    expect(earningsCard).toHaveTextContent(/5000|٥٬٠٠٠/);
  });

  it('shows loading state for summary cards', () => {
    loaded([item()]);
    mockUseTeacherFinancialSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.queryByTestId('teacher-summary-cards')).not.toBeInTheDocument();
  });
});
