// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherPendingReviewPage } from './TeacherPendingReviewPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ar' } }),
}));

const navigateFn = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateFn };
});

vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/features/auth/store/authSlice', () => ({
  logoutUser: vi.fn(() => ({ type: 'logout' })),
}));

const mockGet = vi.fn();
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

let originalClipboard: PropertyDescriptor | undefined;

beforeAll(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});
afterAll(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  }
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TeacherPendingReviewPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const BASE_RESPONSE = {
  data: {
    data: {
      teacherApprovalState: 'PENDING_REVIEW',
      accessState: 'TEACHER_PENDING_REVIEW',
      canAccessTeacherFeatures: false,
      request: {
        publicReference: 'TR-2026-ABCDEF',
        status: 'PENDING',
        submittedAt: '2026-01-01T00:00:00.000Z',
        reviewedAt: null,
      },
      message: 'مرحبًا بك، تم استلام طلبك',
    },
  },
};

describe('TeacherPendingReviewPage', () => {
  it('renders the tracking reference number', async () => {
    mockGet.mockResolvedValue(BASE_RESPONSE);
    renderPage();
    expect(await screen.findByText('TR-2026-ABCDEF')).toBeInTheDocument();
  });

  it('renders the tracking reference label', async () => {
    mockGet.mockResolvedValue(BASE_RESPONSE);
    renderPage();
    expect(await screen.findByText('auth:trackingReference')).toBeInTheDocument();
  });

  it('copy button writes reference to clipboard', async () => {
    mockGet.mockResolvedValue(BASE_RESPONSE);
    renderPage();
    const btn = await screen.findByTitle('auth:copyReference');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TR-2026-ABCDEF');
    });
  });

  it('shows check icon after copy', async () => {
    mockGet.mockResolvedValue(BASE_RESPONSE);
    renderPage();
    const btn = await screen.findByTitle('auth:copyReference');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTitle('auth:copyReference').querySelector('svg')).toBeInTheDocument();
    });
  });

  it('does not show reference block when request is null', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          teacherApprovalState: 'PENDING_REVIEW',
          accessState: 'TEACHER_PENDING_REVIEW',
          canAccessTeacherFeatures: false,
          request: null,
          message: 'مرحبًا',
        },
      },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText('auth:trackingReference')).not.toBeInTheDocument();
    });
  });
});
