// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherPlanBadge } from './TeacherPlanBadge';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));
vi.mock('@/features/teacher/api/teacherPlans', () => ({
  teacherPlansApi: { getMySubscription: vi.fn() },
}));

const mApi = teacherPlansApi as unknown as { getMySubscription: ReturnType<typeof vi.fn> };

function renderBadge() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TeacherPlanBadge /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherPlanBadge', () => {
  it('FREE_PLAN shows the free badge with an upgrade CTA', async () => {
    mApi.getMySubscription.mockResolvedValue({
      accessState: 'FREE_PLAN', upgradeAvailable: true,
      currentPlan: { id: 'f', code: 'FREE', displayName: 'Free' },
    } as never);
    renderBadge();
    expect(await screen.findByTestId('free-plan-badge')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-cta')).toHaveAttribute('href', '/teacher/plans');
  });

  it('PAID_PLAN shows the paid badge and NO upgrade CTA', async () => {
    mApi.getMySubscription.mockResolvedValue({
      accessState: 'PAID_PLAN', upgradeAvailable: false,
      currentPlan: { id: 'p', code: 'PRO', displayName: 'Pro' },
    } as never);
    renderBadge();
    expect(await screen.findByTestId('paid-plan-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('free-plan-badge')).not.toBeInTheDocument();
  });

  it('renders nothing while there is no data', async () => {
    mApi.getMySubscription.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = renderBadge();
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });
});
