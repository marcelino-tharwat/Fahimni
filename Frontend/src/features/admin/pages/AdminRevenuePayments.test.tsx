// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminRevenuePage } from './AdminRevenuePage';
import { AdminPaymentsPage } from './AdminPaymentsPage';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import * as hooks from '@/features/admin/hooks/useAdminRevenue';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key, i18n: { language: 'ar' } }),
}));
vi.mock('@/shared/components/layout/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('@/features/admin/hooks/useAdminRevenue');

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false } as never);
const page = <T,>(rows: T[]) => ({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } });
const teacher = { id: 't-1', fullName: 'Teacher One' };

function primeRevenue() {
  vi.mocked(hooks.useRevenueSummary).mockReturnValue(ok({
    confirmedCourseRevenue: 500, confirmedTeacherSubscriptionRevenue: 199, totalConfirmedRevenue: 699,
    monthlyConfirmedRevenue: 300, freeTeachersCount: 4, paidTeachersCount: 1,
    pendingCoursePayments: 2, failedCoursePayments: 1, pendingSubscriptionPayments: 1, failedSubscriptionPayments: 0,
    currency: 'EGP', reliabilityWarnings: ['note one'],
  }));
  vi.mocked(hooks.useRevenueByTeacher).mockReturnValue(
    ok(page([{ teacher, courseRevenue: 500, subscriptionRevenue: 199, successfulCoursePayments: 3 }])),
  );
  vi.mocked(hooks.useRevenueByChapter).mockReturnValue(
    ok(page([{ chapter: { id: 'c-1', name: 'Chapter One' }, teacher, confirmedRevenue: 500, successfulPayments: 3 }])),
  );
}

function primePayments() {
  vi.mocked(hooks.useCoursePayments).mockReturnValue(
    ok(page([{ id: 'cp-1', student: { id: 's-1', fullName: 'Student', email: 's@x.io' }, chapter: { id: 'c-1', name: 'Chapter One' }, teacher, amount: 100, currency: 'EGP', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z', paidAt: '2026-01-01T00:00:00Z' }])),
  );
  vi.mocked(hooks.useSubscriptionPayments).mockReturnValue(
    ok(page([{ id: 'sp-1', teacher: { ...teacher, email: 't@x.io' }, plan: { id: 'p', code: 'PRO', displayName: 'Pro' }, amount: 199, currency: 'EGP', billingInterval: 'MONTHLY', status: 'PENDING', provider: 'PAYMOB', createdAt: '2026-01-01T00:00:00Z', paidAt: null }])),
  );
}

beforeEach(() => { vi.clearAllMocks(); primeRevenue(); primePayments(); });
afterEach(() => cleanup());

describe('AdminRevenuePage', () => {
  const renderPage = () => render(<MemoryRouter><AdminRevenuePage /></MemoryRouter>);

  it('1. renders the revenue page', () => {
    renderPage();
    expect(screen.getByTestId('admin-revenue-page')).toBeInTheDocument();
  });

  it('2. renders the revenue cards', () => {
    renderPage();
    ['card-total-revenue', 'card-course-revenue', 'card-subscription-revenue', 'card-monthly-revenue'].forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });
  });

  it('3. renders free / paid teacher counts', () => {
    renderPage();
    // Numbers render with the ar-EG locale (Arabic-Indic digits), so compare
    // against the same localized form rather than ASCII digits.
    expect(screen.getByTestId('card-free-teachers')).toHaveTextContent((4).toLocaleString('ar-EG'));
    expect(screen.getByTestId('card-paid-teachers')).toHaveTextContent((1).toLocaleString('ar-EG'));
  });

  it('4. renders the revenue-by-teacher table', () => {
    renderPage();
    expect(screen.getByTestId('revenue-by-teacher-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('teacher-link')[0]).toHaveAttribute('href', '/admin/teachers/t-1');
  });

  it('5. renders the revenue-by-chapter table', () => {
    renderPage();
    expect(screen.getByTestId('revenue-by-chapter-table')).toBeInTheDocument();
    expect(screen.getByText('Chapter One')).toBeInTheDocument();
  });
});

describe('AdminPaymentsPage', () => {
  const renderPage = () => render(<MemoryRouter><AdminPaymentsPage /></MemoryRouter>);

  it('6. renders the payments page', () => {
    renderPage();
    expect(screen.getByTestId('admin-payments-page')).toBeInTheDocument();
  });

  it('7. course payments tab renders', () => {
    renderPage();
    expect(screen.getByTestId('course-payments-table')).toBeInTheDocument();
    expect(screen.getByTestId('payment-status-SUCCESS')).toBeInTheDocument();
  });

  it('8. subscription payments tab renders', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-subscriptions'));
    expect(screen.getByTestId('subscription-payments-table')).toBeInTheDocument();
    expect(screen.getByTestId('payment-status-PENDING')).toBeInTheDocument();
  });

  it('9. filters render', () => {
    renderPage();
    expect(screen.getByTestId('payment-filters')).toBeInTheDocument();
    expect(screen.getByTestId('filter-status')).toBeInTheDocument();
    expect(screen.getByTestId('filter-date-from')).toBeInTheDocument();
    expect(screen.getByTestId('filter-date-to')).toBeInTheDocument();
  });

  it('10. no raw callback / provider secret is rendered', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByTestId('tab-subscriptions'));
    expect(container.innerHTML).not.toMatch(/rawCallback|checkoutUrl|paymobOrderId|hmac|secret/i);
  });
});

describe('Admin sidebar', () => {
  it('11. sidebar links Revenue and Payments', () => {
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    const revenue = screen.getAllByRole('link', { name: 'nav.revenue' });
    const payments = screen.getAllByRole('link', { name: 'nav.payments' });
    expect(revenue.length).toBeGreaterThan(0);
    expect(payments.length).toBeGreaterThan(0);
    revenue.forEach((l) => expect(l).toHaveAttribute('href', '/admin/revenue'));
    payments.forEach((l) => expect(l).toHaveAttribute('href', '/admin/payments'));
  });
});
