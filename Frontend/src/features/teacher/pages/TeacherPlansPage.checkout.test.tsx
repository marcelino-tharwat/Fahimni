// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeacherPlansPage } from './TeacherPlansPage';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import type { TeacherPlan, SubscriptionMeResponse } from '@/features/teacher/types/teacherPlans';

// t returns the key (so we can assert on i18n keys directly).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/teacher/api/teacherPlans', () => ({
  teacherPlansApi: {
    getPlans: vi.fn(),
    getMySubscription: vi.fn(),
    checkout: vi.fn(),
    createRequest: vi.fn(),
  },
}));

const api = teacherPlansApi as unknown as {
  getPlans: ReturnType<typeof vi.fn>;
  getMySubscription: ReturnType<typeof vi.fn>;
  checkout: ReturnType<typeof vi.fn>;
  createRequest: ReturnType<typeof vi.fn>;
};

const PLANS: TeacherPlan[] = [
  {
    id: 'free-1', code: 'FREE', displayName: 'Free', description: null,
    monthlyPrice: 0, yearlyPrice: null, currency: 'EGP', isRecommended: false,
    features: [], limits: {},
  },
  {
    id: 'basic-1', code: 'BASIC', displayName: 'Basic', description: null,
    monthlyPrice: 199, yearlyPrice: 1990, currency: 'EGP', isRecommended: false,
    features: [], limits: {},
  },
];

function freeSubscription(overrides: Partial<SubscriptionMeResponse> = {}): SubscriptionMeResponse {
  return {
    currentPlan: { id: 'free-1', code: 'FREE', displayName: 'Free' },
    subscription: null,
    effectivePlanCode: 'FREE',
    accessState: 'FREE_PLAN',
    entitlementSource: 'DEFAULT_FREE_PLAN',
    paymentRequired: false,
    upgradeAvailable: true,
    pendingRequest: null,
    pendingPayment: null,
    usage: {
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-07-31T23:59:59.999Z',
      aiQuizGenerations: { used: 0, limit: 5, remaining: 5 },
      aiEssayGradings: { used: 0, limit: 10, remaining: 10 },
      aiContentGenerations: { used: 0, limit: 0, remaining: 0 },
      students: { used: 0, limit: 50 },
      storageMb: { used: 0, limit: 500 },
    },
    ...overrides,
  };
}

let assignMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: assignMock, href: '' },
  });
  api.getPlans.mockResolvedValue(PLANS);
  api.getMySubscription.mockResolvedValue(freeSubscription());
});

afterEach(() => cleanup());

describe('TeacherPlansPage — checkout behavior', () => {
  it('renders plans from the API', async () => {
    render(<TeacherPlansPage />);
    // Price from API data is rendered directly.
    expect(await screen.findByText('199')).toBeInTheDocument();
    expect(api.getPlans).toHaveBeenCalled();
  });

  it('main paid button calls checkout with the plan id + interval', async () => {
    api.checkout.mockResolvedValue({
      paymentId: 'p1', orderId: 'o1', checkoutUrl: 'https://pay.test/go',
      amount: 199, currency: 'EGP', billingInterval: 'MONTHLY', status: 'PENDING', message: 'ok',
    });
    render(<TeacherPlansPage />);
    const payBtn = await screen.findByText('plans.payNow');
    fireEvent.click(payBtn);
    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith({ planId: 'basic-1', billingInterval: 'MONTHLY' }));
    expect(api.createRequest).not.toHaveBeenCalled(); // manual request is NOT the paid flow
  });

  it('redirects to the provider checkoutUrl on success (no fake success message)', async () => {
    api.checkout.mockResolvedValue({
      paymentId: 'p1', orderId: 'o1', checkoutUrl: 'https://pay.test/go',
      amount: 199, currency: 'EGP', billingInterval: 'MONTHLY', status: 'PENDING', message: 'ok',
    });
    render(<TeacherPlansPage />);
    fireEvent.click(await screen.findByText('plans.payNow'));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://pay.test/go'));
    // No success banner is rendered (success only after confirmed payment).
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
  });

  it('renders the pending-payment alert when a payment is awaiting confirmation', async () => {
    api.getMySubscription.mockResolvedValue(
      freeSubscription({
        pendingPayment: {
          id: 'pay-1', planId: 'basic-1', planCode: 'BASIC', billingInterval: 'MONTHLY',
          amount: 199, currency: 'EGP', status: 'PENDING', checkoutUrl: 'https://pay.test/resume',
          createdAt: '2026-07-07T00:00:00.000Z',
        },
      }),
    );
    render(<TeacherPlansPage />);
    expect(await screen.findByText('plans.paymentPendingAlert')).toBeInTheDocument();
    expect(screen.getByText('plans.completePayment')).toBeInTheDocument();
  });

  it('shows the payment-unavailable message when the provider is down', async () => {
    api.checkout.mockRejectedValue({ code: 'PAYMENT_PROVIDER_UNAVAILABLE', statusCode: 502, message: 'x' });
    render(<TeacherPlansPage />);
    fireEvent.click(await screen.findByText('plans.payNow'));
    expect(await screen.findByText('plans.paymentUnavailable')).toBeInTheDocument();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('exposes the manual request only as a secondary action', async () => {
    render(<TeacherPlansPage />);
    await screen.findByText('plans.payNow');
    // Secondary manual-review link exists but is not the primary button.
    expect(screen.getByText('plans.requestManualReview')).toBeInTheDocument();
  });

  it('shows the FREE-plan upgrade banner (not a payment-required block) for a FREE teacher', async () => {
    render(<TeacherPlansPage />); // default mock is a FREE_PLAN subscription
    expect(await screen.findByTestId('upgrade-banner')).toBeInTheDocument();
    // The old payment-required block must NOT appear for a FREE (allowed) teacher.
    expect(screen.queryByTestId('payment-required-banner')).not.toBeInTheDocument();
  });

  it('does NOT show the upgrade banner for a PAID teacher', async () => {
    api.getMySubscription.mockResolvedValue(
      freeSubscription({
        accessState: 'PAID_PLAN',
        entitlementSource: 'ACTIVE_SUBSCRIPTION',
        upgradeAvailable: false,
        subscription: {
          id: 's1', status: 'ACTIVE', billingInterval: 'MONTHLY',
          currentPeriodStart: '2026-07-01T00:00:00.000Z', currentPeriodEnd: '2026-08-01T00:00:00.000Z', trialEndsAt: null,
        },
      }),
    );
    render(<TeacherPlansPage />);
    await screen.findByText('plans.payNow');
    expect(screen.queryByTestId('upgrade-banner')).not.toBeInTheDocument();
  });
});
