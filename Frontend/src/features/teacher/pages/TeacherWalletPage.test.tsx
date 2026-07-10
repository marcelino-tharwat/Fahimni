// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeacherWalletPage } from './TeacherWalletPage';
import type { TeacherWallet, TeacherWithdrawalListItem } from '@/features/teacher/types/wallet';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      if (typeof opts === 'object' && opts?.defaultValue) return opts.defaultValue as string;
      if (typeof opts === 'object' && typeof opts.amount !== 'undefined') {
        return `${key}:${opts.amount}:${opts.currency}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/store/slices/toastSlice', () => ({
  addToast: vi.fn(),
}));

const { mockUseTeacherWallet, mockUseTeacherWithdrawals, mockUpdateMutate, mockCreateMutate, mockCancelMutate } =
  vi.hoisted(() => ({
    mockUseTeacherWallet: vi.fn(),
    mockUseTeacherWithdrawals: vi.fn(),
    mockUpdateMutate: vi.fn(),
    mockCreateMutate: vi.fn(),
    mockCancelMutate: vi.fn(),
  }));

vi.mock('@/features/teacher/hooks/useTeacherWallet', () => ({
  useTeacherWallet: mockUseTeacherWallet,
  useTeacherWithdrawals: mockUseTeacherWithdrawals,
  useUpdatePayoutProfile: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useCreateWithdrawal: () => ({ mutate: mockCreateMutate, isPending: false }),
  useCancelWithdrawal: () => ({ mutate: mockCancelMutate, isPending: false }),
}));

function wallet(overrides: Partial<TeacherWallet> = {}): TeacherWallet {
  return {
    totalConfirmedEarnings: 300,
    availableBalance: 70,
    heldWithdrawals: 80,
    completedWithdrawals: 150,
    currency: 'EGP',
    latestWithdrawals: [],
    payoutProfile: {
      instaPayHandle: 'ahmed.math@instapay',
      vodafoneCashNumber: '01001234567',
      payoutMethodUpdatedAt: '2026-06-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function withdrawal(overrides: Partial<TeacherWithdrawalListItem> = {}): TeacherWithdrawalListItem {
  return {
    id: 'w1',
    amount: 150,
    currency: 'EGP',
    status: 'TRANSFERRED',
    payoutMethodSnapshot: { instaPayHandle: 'ahmed.math@instapay', vodafoneCashNumber: '01001234567' },
    teacherNote: null,
    requestedAt: '2026-06-01T00:00:00.000Z',
    processedAt: '2026-06-02T00:00:00.000Z',
    transferredAt: '2026-06-03T00:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

function loaded(data: TeacherWallet, withdrawals: TeacherWithdrawalListItem[] = []) {
  mockUseTeacherWallet.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseTeacherWithdrawals.mockReturnValue({ data: withdrawals, isLoading: false, isError: false });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherWalletPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherWalletPage', () => {
  it('1. renders the wallet page', () => {
    loaded(wallet());
    renderPage();
    expect(screen.getByTestId('teacher-wallet-page')).toBeInTheDocument();
  });

  it('2. renders all four balance cards with correct values', () => {
    loaded(wallet());
    renderPage();
    // Values render via toLocaleString('ar-EG') — Arabic-Indic digits.
    const ar = (n: number) => n.toLocaleString('ar-EG');
    expect(
      within(screen.getByTestId('card-total-earnings')).getByText(new RegExp(ar(300))),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('card-available-balance')).getByText(new RegExp(ar(70))),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('card-held-withdrawals')).getByText(new RegExp(ar(80))),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('card-completed-withdrawals')).getByText(new RegExp(ar(150))),
    ).toBeInTheDocument();
  });

  it('renders the withdrawals table when data exists', () => {
    loaded(wallet(), [withdrawal()]);
    renderPage();
    expect(screen.getByTestId('withdrawals-table')).toBeInTheDocument();
  });

  it('renders the empty state when there are no withdrawals', () => {
    loaded(wallet(), []);
    renderPage();
    expect(screen.getByTestId('withdrawals-empty')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    mockUseTeacherWallet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    mockUseTeacherWithdrawals.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByTestId('wallet-skeleton')).toBeInTheDocument();
  });

  it('shows the error state with a retry action', () => {
    const refetch = vi.fn();
    mockUseTeacherWallet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    mockUseTeacherWithdrawals.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderPage();
    fireEvent.click(screen.getByText('wallet.retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('3. payout profile section renders current values and opens the edit form', () => {
    loaded(wallet());
    renderPage();
    expect(screen.getByTestId('instapay-value')).toHaveTextContent('ahmed.math@instapay');
    expect(screen.getByTestId('vodafone-value')).toHaveTextContent('01001234567');

    fireEvent.click(screen.getByTestId('edit-payout-profile-btn'));
    expect(screen.getByLabelText('wallet.payoutProfile.instaPayHandle')).toBeInTheDocument();
    expect(screen.getByLabelText('wallet.payoutProfile.vodafoneCashNumber')).toBeInTheDocument();
  });

  it('4. updating the payout profile calls the mutation with the new values', async () => {
    loaded(wallet());
    renderPage();
    fireEvent.click(screen.getByTestId('edit-payout-profile-btn'));

    const instaInput = screen.getByLabelText('wallet.payoutProfile.instaPayHandle');
    fireEvent.change(instaInput, { target: { value: 'new.handle@instapay' } });

    fireEvent.click(screen.getByText('wallet.payoutProfile.save'));

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ instaPayHandle: 'new.handle@instapay' }),
        expect.any(Object),
      );
    });
  });

  it('5a. whitespace-only InstaPay handle shows a validation error and does not call the mutation', async () => {
    loaded(wallet());
    renderPage();
    fireEvent.click(screen.getByTestId('edit-payout-profile-btn'));

    const instaInput = screen.getByLabelText('wallet.payoutProfile.instaPayHandle');
    fireEvent.change(instaInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('wallet.payoutProfile.save'));

    await waitFor(() => {
      expect(screen.getByText('wallet.validation.instaPayMin')).toBeInTheDocument();
    });
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it('5b. invalid Vodafone Cash number shows a validation error and does not call the mutation', async () => {
    loaded(wallet());
    renderPage();
    fireEvent.click(screen.getByTestId('edit-payout-profile-btn'));

    const vodafoneInput = screen.getByLabelText('wallet.payoutProfile.vodafoneCashNumber');
    fireEvent.change(vodafoneInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText('wallet.payoutProfile.save'));

    await waitFor(() => {
      expect(screen.getByText('wallet.validation.vodafoneInvalid')).toBeInTheDocument();
    });
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  // ── Withdrawal request / cancel flow ──────────────────────────────────────

  it('renders a "no payout method" warning when neither payout field is set', () => {
    loaded(
      wallet({
        payoutProfile: { instaPayHandle: null, vodafoneCashNumber: null, payoutMethodUpdatedAt: null },
      }),
    );
    renderPage();
    expect(screen.getByTestId('no-payout-method-warning')).toBeInTheDocument();
  });

  it('does not render the no-payout-method warning when a payout method is set', () => {
    loaded(wallet());
    renderPage();
    expect(screen.queryByTestId('no-payout-method-warning')).not.toBeInTheDocument();
  });

  it('request withdrawal modal renders and submits', async () => {
    loaded(wallet());
    renderPage();
    fireEvent.click(screen.getByTestId('request-withdrawal-btn'));

    const amountInput = screen.getByLabelText('wallet.withdrawals.amount');
    fireEvent.change(amountInput, { target: { value: '50' } });
    fireEvent.click(screen.getByText('wallet.withdrawals.submit'));

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50 }),
        expect.any(Object),
      );
    });
  });

  it('over-balance error renders and the mutation is not called', async () => {
    loaded(wallet({ availableBalance: 70 }));
    renderPage();
    fireEvent.click(screen.getByTestId('request-withdrawal-btn'));

    const amountInput = screen.getByLabelText('wallet.withdrawals.amount');
    fireEvent.change(amountInput, { target: { value: '999' } });
    fireEvent.click(screen.getByText('wallet.withdrawals.submit'));

    await waitFor(() => {
      expect(screen.getByText('wallet.withdrawals.validation.amountExceedsBalance')).toBeInTheDocument();
    });
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('5 & 13. cancel button appears only for PENDING and disappears once it leaves PENDING', () => {
    loaded(wallet(), [
      withdrawal({ id: 'w-pending', status: 'PENDING' }),
      withdrawal({ id: 'w-processing', status: 'PROCESSING' }),
    ]);
    renderPage();
    expect(screen.getByTestId('cancel-withdrawal-w-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-withdrawal-w-processing')).not.toBeInTheDocument();
  });

  it('clicking cancel calls the cancel mutation for that withdrawal', () => {
    loaded(wallet(), [withdrawal({ id: 'w-pending', status: 'PENDING' })]);
    renderPage();
    fireEvent.click(screen.getByTestId('cancel-withdrawal-w-pending'));
    expect(mockCancelMutate).toHaveBeenCalledWith('w-pending', expect.any(Object));
  });

  it('12. final statuses (TRANSFERRED/REJECTED/CANCELLED) render read-only rows with no cancel button', () => {
    loaded(wallet(), [
      withdrawal({ id: 'w-t', status: 'TRANSFERRED' }),
      withdrawal({ id: 'w-r', status: 'REJECTED' }),
      withdrawal({ id: 'w-c', status: 'CANCELLED' }),
    ]);
    renderPage();
    expect(screen.queryByTestId('cancel-withdrawal-w-t')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-withdrawal-w-r')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-withdrawal-w-c')).not.toBeInTheDocument();
  });

  it('9. status badges render for every withdrawal status', () => {
    loaded(wallet(), [
      withdrawal({ id: 'w1', status: 'PENDING' }),
      withdrawal({ id: 'w2', status: 'PROCESSING' }),
      withdrawal({ id: 'w3', status: 'TRANSFERRED' }),
      withdrawal({ id: 'w4', status: 'REJECTED' }),
      withdrawal({ id: 'w5', status: 'CANCELLED' }),
    ]);
    renderPage();
    for (const status of ['PENDING', 'PROCESSING', 'TRANSFERRED', 'REJECTED', 'CANCELLED']) {
      expect(screen.getByText(`wallet.withdrawals.statusLabels.${status}`)).toBeInTheDocument();
    }
  });
});
