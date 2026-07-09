// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminSubscriptionsPage } from './AdminSubscriptionsPage';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import * as hooks from '@/features/admin/hooks/useAdminSubscriptions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key, i18n: { language: 'ar' } }),
}));
vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));
vi.mock('@/shared/components/layout/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('@/features/admin/hooks/useAdminSubscriptions');

const teacher = { id: 't-1', fullName: 'Teacher One', email: 't1@x.local' };
const plan = (code: string) => ({ id: `p-${code}`, code, displayName: `${code} Plan` });

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false } as never);
const page = <T,>(rows: T[]) => ({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } });

function primeHooks() {
  vi.mocked(hooks.useAdminEntitlements).mockReturnValue(
    ok(page([
      { teacher, entitlementSource: 'DEFAULT_FREE_PLAN', currentPlan: plan('FREE'), activeSubscription: null, pendingPayment: null, failedPaymentsCount: 0, successfulPaymentsCount: 0, confirmedSubscriptionRevenue: 0 },
      { teacher: { ...teacher, id: 't-2', fullName: 'Teacher Two' }, entitlementSource: 'ACTIVE_SUBSCRIPTION', currentPlan: plan('PRO'), activeSubscription: null, pendingPayment: null, failedPaymentsCount: 0, successfulPaymentsCount: 2, confirmedSubscriptionRevenue: 398 },
    ])),
  );
  vi.mocked(hooks.useAdminSubscriptionsList).mockReturnValue(
    ok(page([{ id: 's-1', teacher, plan: plan('PRO'), status: 'ACTIVE', billingInterval: 'MONTHLY', startedAt: '2026-01-01T00:00:00Z', currentPeriodStart: '2026-01-01T00:00:00Z', currentPeriodEnd: '2026-12-01T00:00:00Z', cancelledAt: null, trialEndsAt: null, createdAt: '2026-01-01T00:00:00Z' }])),
  );
  vi.mocked(hooks.useAdminPayments).mockReturnValue(
    ok(page([
      { id: 'pay-1', teacher, plan: plan('PRO'), amount: 199, currency: 'EGP', status: 'SUCCESS', provider: 'PAYMOB', createdAt: '2026-01-01T00:00:00Z', paidAt: '2026-01-01T00:00:00Z' },
      { id: 'pay-2', teacher, plan: plan('PRO'), amount: 199, currency: 'EGP', status: 'PENDING', provider: 'PAYMOB', createdAt: '2026-01-02T00:00:00Z', paidAt: null },
      { id: 'pay-3', teacher, plan: plan('PRO'), amount: 199, currency: 'EGP', status: 'FAILED', provider: 'PAYMOB', createdAt: '2026-01-03T00:00:00Z', paidAt: null },
    ])),
  );
  vi.mocked(hooks.useAdminSubscriptionRequests).mockReturnValue(
    ok(page([{ id: 'req-1', teacher, plan: plan('PRO'), requestedInterval: 'MONTHLY', status: 'PENDING', adminNotes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }])),
  );
  vi.mocked(hooks.useAdminAiUsage).mockReturnValue(
    ok({ ...page([{ teacher, totalEvents: 2, totalUnits: 5, currentMonthUnits: 5, byType: { AI_QUIZ_GENERATION: 3, AI_ESSAY_GRADING: 2, AI_CONTENT_GENERATION: 0, AI_LESSON_SUMMARY: 0, AI_QUESTION_EXPLANATION: 0 } }]), totals: { totalEvents: 2, totalUnits: 5, byType: { AI_QUIZ_GENERATION: 3, AI_ESSAY_GRADING: 2, AI_CONTENT_GENERATION: 0, AI_LESSON_SUMMARY: 0, AI_QUESTION_EXPLANATION: 0 } } }),
  );
  vi.mocked(hooks.useReviewSubscriptionRequest).mockReturnValue({
    approve: { mutate: vi.fn(), isPending: false },
    reject: { mutate: vi.fn(), isPending: false },
  } as never);
}

function renderPage() {
  return render(<MemoryRouter><AdminSubscriptionsPage /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); primeHooks(); });
afterEach(() => cleanup());

describe('AdminSubscriptionsPage', () => {
  it('1. renders the page', () => {
    renderPage();
    expect(screen.getByTestId('admin-subscriptions-page')).toBeInTheDocument();
  });

  it('2. renders all five tabs', () => {
    renderPage();
    ['entitlements', 'subscriptions', 'payments', 'requests', 'ai-usage'].forEach((k) => {
      expect(screen.getByTestId(`tab-${k}`)).toBeInTheDocument();
    });
  });

  it('3 & 4. renders free and paid entitlement badges', () => {
    renderPage();
    expect(screen.getByTestId('entitlement-badge-free')).toBeInTheDocument();
    expect(screen.getByTestId('entitlement-badge-paid')).toBeInTheDocument();
  });

  it('5. payments tab renders SUCCESS / PENDING / FAILED badges', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-payments'));
    expect(screen.getByTestId('payment-status-SUCCESS')).toBeInTheDocument();
    expect(screen.getByTestId('payment-status-PENDING')).toBeInTheDocument();
    expect(screen.getByTestId('payment-status-FAILED')).toBeInTheDocument();
  });

  it('6. manual requests tab renders approve/reject controls', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-requests'));
    expect(screen.getByTestId('manual-approve-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manual-reject-btn')).toBeInTheDocument();
  });

  it('7. AI usage tab renders the usage table', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-ai-usage'));
    expect(screen.getByTestId('ai-usage-table')).toBeInTheDocument();
  });

  it('8. teacher links point to /admin/teachers/:id', () => {
    renderPage();
    const link = screen.getAllByTestId('teacher-link')[0]!;
    expect(link).toHaveAttribute('href', '/admin/teachers/t-1');
  });

  it('10. no raw callback / checkoutUrl / secret is ever rendered', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByTestId('tab-payments'));
    const html = container.innerHTML;
    expect(html).not.toMatch(/rawCallback|checkoutUrl|hmac|secret/i);
  });
});

describe('Admin sidebar', () => {
  it('9. sidebar links Subscriptions to /admin/subscriptions', () => {
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    // The sidebar renders desktop + mobile variants, so there may be >1 link.
    const links = screen.getAllByRole('link', { name: 'nav.subscriptions' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/admin/subscriptions'));
  });
});
