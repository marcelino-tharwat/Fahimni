// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPlansPage } from './AdminPlansPage';
import { useAdminPlans } from '@/features/admin/hooks/useAdminPlans';
import type { AdminPlanListItem, AdminPlansListResponse } from '@/features/admin/types/plans';

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

vi.mock('@/features/admin/hooks/useAdminPlans', () => ({
  useAdminPlans: vi.fn(),
}));

const mockUseAdminPlans = useAdminPlans as unknown as ReturnType<typeof vi.fn>;

function plan(overrides: Partial<AdminPlanListItem> = {}): AdminPlanListItem {
  return {
    id: 'plan-1',
    code: 'FREE',
    name: 'free',
    displayName: 'الباقة المجانية',
    description: 'ابدأ رحلتك التعليمية',
    monthlyPrice: 0,
    yearlyPrice: null,
    currency: 'EGP',
    isActive: true,
    isRecommended: false,
    sortOrder: 0,
    features: ['ميزة ١', 'ميزة ٢'],
    limits: { aiQuizGenerationsPerMonth: 5 },
    stats: {
      freeEntitlementsCount: 10,
      activePaidSubscriptionsCount: 0,
      pendingPaymentsCount: 0,
      successfulPaymentsCount: 0,
      confirmedRevenue: 0,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function paidPlan(overrides: Partial<AdminPlanListItem> = {}): AdminPlanListItem {
  return plan({
    id: 'plan-2',
    code: 'PRO',
    name: 'pro',
    displayName: 'الباقة الاحترافية',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    isRecommended: true,
    stats: {
      freeEntitlementsCount: 0,
      activePaidSubscriptionsCount: 5,
      pendingPaymentsCount: 1,
      successfulPaymentsCount: 10,
      confirmedRevenue: 4990,
    },
    ...overrides,
  });
}

function loaded(data: AdminPlansListResponse) {
  mockUseAdminPlans.mockReturnValue({
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
      <AdminPlansPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('AdminPlansPage', () => {
  it('1. renders the page title', () => {
    loaded({ data: [plan()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(screen.getByText('adminPlans.title')).toBeInTheDocument();
  });

  it('2. renders search box and active/inactive filter buttons', () => {
    loaded({ data: [plan()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(screen.getByLabelText('adminPlans.searchPlaceholder')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'adminPlans.filterLabel' });
    expect(within(group).getByText('adminPlans.filter.ALL')).toBeInTheDocument();
    expect(within(group).getByText('adminPlans.filter.ACTIVE')).toBeInTheDocument();
    expect(within(group).getByText('adminPlans.filter.INACTIVE')).toBeInTheDocument();
  });

  it('3. renders plans list with data', () => {
    loaded({
      data: [plan(), paidPlan()],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('الباقة المجانية')).toBeInTheDocument();
    expect(screen.getByText('الباقة الاحترافية')).toBeInTheDocument();
  });

  it('4. FREE plan badge renders (مجاني)', () => {
    loaded({
      data: [plan()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('adminPlans.badges.free')).toBeInTheDocument();
  });

  it('5. paid plan badge renders (مدفوع)', () => {
    loaded({
      data: [paidPlan()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('adminPlans.badges.paid')).toBeInTheDocument();
  });

  it('6. recommended badge renders for recommended plan', () => {
    loaded({
      data: [paidPlan()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('adminPlans.badges.recommended')).toBeInTheDocument();
  });

  it('7. renders active/inactive badges', () => {
    loaded({
      data: [
        plan({ isActive: true }),
        plan({ id: 'plan-3', code: 'OLD', displayName: 'Old Plan', isActive: false }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('adminPlans.badges.active')).toBeInTheDocument();
    expect(screen.getAllByText('adminPlans.badges.inactive').length).toBeGreaterThanOrEqual(1);
  });

  it('8. renders the empty state when there are no plans', () => {
    loaded({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderPage();
    expect(screen.getByText('adminPlans.emptyTitle')).toBeInTheDocument();
  });

  it('9. view details link points to /admin/plans/:planId', () => {
    loaded({
      data: [plan({ id: 'plan-xyz' })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    const link = screen.getByRole('link', { name: /adminPlans\.viewDetails/ });
    expect(link).toHaveAttribute('href', '/admin/plans/plan-xyz');
  });

  it('10. renders loading state', () => {
    mockUseAdminPlans.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByLabelText('common:status.loading')).toBeInTheDocument();
  });

  it('11. renders error state with retry button', () => {
    mockUseAdminPlans.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('adminPlans.errorLoading')).toBeInTheDocument();
    expect(screen.getByText('adminPlans.retry')).toBeInTheDocument();
  });

  it('12. shows revenue as 0 for FREE plan', () => {
    loaded({
      data: [plan()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    const moneyString = `0 ${'adminPlans.currency'}`;
    expect(screen.getByText(moneyString)).toBeInTheDocument();
  });
});
