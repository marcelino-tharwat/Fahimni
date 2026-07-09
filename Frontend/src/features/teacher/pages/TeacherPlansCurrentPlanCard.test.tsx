// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeacherPlansCurrentPlanCard } from './TeacherPlansCurrentPlanCard';
import type { SubscriptionMeResponse } from '@/features/teacher/types/teacherPlans';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => cleanup());

const freeData: SubscriptionMeResponse = {
  currentPlan: { id: 'free-1', code: 'FREE', displayName: 'الباقة المجانية' },
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
    aiQuizGenerations: { used: 2, limit: 5, remaining: 3 },
    aiEssayGradings: { used: 4, limit: 10, remaining: 6 },
    aiContentGenerations: { used: 0, limit: 0, remaining: 0 },
    students: { used: 10, limit: 50 },
    storageMb: { used: 50, limit: 500 },
  },
};

const proData: SubscriptionMeResponse = {
  currentPlan: { id: 'pro-1', code: 'PRO', displayName: 'الباقة الاحترافية' },
  subscription: {
    id: 'sub-1',
    status: 'ACTIVE',
    billingInterval: 'MONTHLY',
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-07-31T23:59:59.999Z',
    trialEndsAt: null,
  },
  effectivePlanCode: 'PRO',
  accessState: 'PAID_PLAN',
  entitlementSource: 'ACTIVE_SUBSCRIPTION',
  paymentRequired: false,
  upgradeAvailable: false,
  pendingRequest: null,
  pendingPayment: null,
  usage: {
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T23:59:59.999Z',
    aiQuizGenerations: { used: 15, limit: 100, remaining: 85 },
    aiEssayGradings: { used: 30, limit: 500, remaining: 470 },
    aiContentGenerations: { used: 5, limit: 50, remaining: 45 },
    students: { used: 80, limit: 500 },
    storageMb: { used: 512, limit: 10240 },
  },
};

describe('TeacherPlansCurrentPlanCard', () => {
  it('renders FREE badge when no subscription (free plan)', () => {
    render(<TeacherPlansCurrentPlanCard data={freeData} />);
    expect(screen.getByText('plans.freePlan')).toBeInTheDocument();
    expect(screen.getByText('plans.planNames.FREE')).toBeInTheDocument();
  });

  it('renders current plan display name', () => {
    render(<TeacherPlansCurrentPlanCard data={freeData} />);
    expect(screen.getByText('plans.currentPlan')).toBeInTheDocument();
  });

  it('renders subscription status badge for active subscription', () => {
    render(<TeacherPlansCurrentPlanCard data={proData} />);
    expect(screen.getByText('plans.statusActive')).toBeInTheDocument();
  });

  it('shows period dates when subscription exists', () => {
    render(<TeacherPlansCurrentPlanCard data={proData} />);
    expect(screen.getByText('plans.periodStart')).toBeInTheDocument();
    expect(screen.getByText('plans.periodEnd')).toBeInTheDocument();
  });

  it('does not show period dates when no subscription', () => {
    render(<TeacherPlansCurrentPlanCard data={freeData} />);
    expect(screen.queryByText('plans.periodStart')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.periodEnd')).not.toBeInTheDocument();
  });

  it('renders usage meters section', () => {
    render(<TeacherPlansCurrentPlanCard data={freeData} />);
    expect(screen.getByText('plans.usageTitle')).toBeInTheDocument();
  });

  it('renders no data message when data is null', () => {
    render(<TeacherPlansCurrentPlanCard data={null} />);
    expect(screen.getByText('plans.noData')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<TeacherPlansCurrentPlanCard data={null} isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });
});
