// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminPromoCodesManagementPage } from './AdminPromoCodesManagementPage';
import * as hooks from '@/features/admin/hooks/useAdminPlatformPromoCodes';
import { adminPlansApi } from '@/features/admin/api/adminPlans';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, f?: string) => f ?? k }) }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('@/features/admin/hooks/useAdminPlatformPromoCodes');
vi.mock('@/features/admin/api/adminPlans', () => ({ adminPlansApi: { list: vi.fn() } }));

const page = <T,>(rows: T[]) => ({ data: rows, meta: { page: 1, limit: 50, total: rows.length, totalPages: 1 } });
const promo = (over: Record<string, unknown>) => ({
  id: 'p1', code: 'SUMMER20', scope: 'TEACHER_PLAN', discountType: 'PERCENTAGE', discountValue: 20,
  currency: 'EGP', startsAt: null, expiresAt: null, isActive: true, maxUses: 100, usedCount: 5,
  perUserLimit: 1, applicablePlanIds: [], billingInterval: 'ALL', displayStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
});

function prime() {
  vi.mocked(hooks.useAdminPromoCodes).mockReturnValue({
    data: page([promo({}), promo({ id: 'p2', code: 'PLAN10', scope: 'TEACHER_PLAN' })]),
    isLoading: false, isError: false,
  } as never);
  vi.mocked(hooks.useAdminPromoMutations).mockReturnValue({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
    changeStatus: { mutate: vi.fn(), isPending: false },
  } as never);
  vi.mocked(adminPlansApi.list).mockResolvedValue(
    { data: [{ id: 'plan-pro', code: 'PRO', displayName: 'Pro' }], meta: {} } as never,
  );
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><AdminPromoCodesManagementPage /></MemoryRouter></QueryClientProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); prime(); });
afterEach(() => cleanup());

describe('AdminPromoCodesManagementPage', () => {
  it('1. renders the promo codes page + table', () => {
    renderPage();
    expect(screen.getByTestId('admin-promo-codes-page')).toBeInTheDocument();
    expect(screen.getByTestId('promo-codes-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('scope-badge-teacher')).toHaveLength(2);
  });

  it('2. scope filter is present and clickable', () => {
    renderPage();
    expect(screen.getByTestId('scope-filter')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scope-filter-TEACHER_PLAN'));
    // The hook is called again with the scope filter.
    expect(hooks.useAdminPromoCodes).toHaveBeenCalledWith(expect.objectContaining({ scope: 'TEACHER_PLAN' }));
  });

  it('3. create modal renders teacher-plan options by default', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('create-promo-btn'));
    expect(screen.getByTestId('create-promo-modal')).toBeInTheDocument();
    expect(screen.getByTestId('promo-code-input')).toBeInTheDocument();
    expect(screen.getByTestId('teacher-plan-options')).toBeInTheDocument();
  });

  it('4, 5 & 6. teacher-plan modal shows plan selector + billing interval', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('create-promo-btn'));
    expect(screen.getByTestId('teacher-plan-options')).toBeInTheDocument();
    expect(screen.getByTestId('promo-billing-select')).toBeInTheDocument();
    // Plan selector populates from the plans API.
    await waitFor(() => expect(screen.getByTestId('promo-plan-selector')).toHaveTextContent('Pro'));
  });

  it('10. status toggle control exists per row (scope-managed independently)', () => {
    renderPage();
    expect(screen.getAllByTestId('toggle-status-btn').length).toBe(2);
  });
});
