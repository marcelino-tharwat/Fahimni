// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeacherWalletPage } from './TeacherWalletPage';
import type { TeacherWallet } from '@/features/teacher/types/wallet';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      if (typeof opts === 'object' && opts?.defaultValue) return opts.defaultValue as string;
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

const { mockUseTeacherWallet, mockMutate } = vi.hoisted(() => ({
  mockUseTeacherWallet: vi.fn(),
  mockMutate: vi.fn(),
}));

vi.mock('@/features/teacher/hooks/useTeacherWallet', () => ({
  useTeacherWallet: mockUseTeacherWallet,
  useUpdatePayoutProfile: () => ({ mutate: mockMutate, isPending: false }),
}));

function wallet(overrides: Partial<TeacherWallet> = {}): TeacherWallet {
  return {
    totalConfirmedEarnings: 300,
    availableBalance: 70,
    heldWithdrawals: 80,
    completedWithdrawals: 150,
    currency: 'EGP',
    latestWithdrawals: [
      {
        id: 'w1',
        amount: 150,
        currency: 'EGP',
        status: 'TRANSFERRED',
        requestedAt: '2026-06-01T00:00:00.000Z',
        processedAt: '2026-06-02T00:00:00.000Z',
        transferredAt: '2026-06-03T00:00:00.000Z',
        cancelledAt: null,
        teacherNote: null,
      },
    ],
    payoutProfile: {
      instaPayHandle: 'ahmed.math@instapay',
      vodafoneCashNumber: '01001234567',
      payoutMethodUpdatedAt: '2026-06-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function loaded(data: TeacherWallet) {
  mockUseTeacherWallet.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
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
    loaded(wallet());
    renderPage();
    expect(screen.getByTestId('withdrawals-table')).toBeInTheDocument();
  });

  it('renders the empty state when there are no withdrawals', () => {
    loaded(wallet({ latestWithdrawals: [] }));
    renderPage();
    expect(screen.getByTestId('withdrawals-empty')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    mockUseTeacherWallet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('wallet-skeleton')).toBeInTheDocument();
  });

  it('shows the error state with a retry action', () => {
    const refetch = vi.fn();
    mockUseTeacherWallet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
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
      expect(mockMutate).toHaveBeenCalledWith(
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
    expect(mockMutate).not.toHaveBeenCalled();
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
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
