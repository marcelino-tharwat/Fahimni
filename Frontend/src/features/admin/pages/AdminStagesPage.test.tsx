// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStagesPage } from './AdminStagesPage';
import { adminStagesApi } from '@/features/admin/api/adminStages';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/shared/store/slices/toastSlice', () => ({ addToast: vi.fn() }));
vi.mock('@/features/admin/api/adminStages', () => ({
  adminStagesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  },
}));

const mApi = adminStagesApi as unknown as { list: ReturnType<typeof vi.fn> };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminStagesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('AdminStagesPage', () => {
  it('renders platform stages and admin-owned controls', async () => {
    mApi.list.mockResolvedValue({
      data: [
        {
          id: 'stage-1',
          name: 'Stage 1',
          description: 'First stage',
          sortOrder: 1,
          teacherId: null,
          isActive: true,
          chapterCount: 4,
          lessonCount: 8,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('New stage')).toBeInTheDocument();
  });
});
