// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherRejectedPage } from './TeacherRejectedPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ar' } }),
}));

const navigateFn = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateFn, Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a> };
});

vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/features/auth/store/authSlice', () => ({
  logoutUser: vi.fn(() => ({ type: 'logout' })),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
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

function buildResponse(overrides: Partial<{
  rejectionMode: 'EDIT_ALLOWED' | 'FINAL_REJECTION' | null;
  rejectionReason: string | null;
  publicReference: string | null;
  canEditAndResubmit: boolean;
  status: string;
}> = {}) {
  return {
    data: {
      data: {
        teacherApprovalState: 'REJECTED',
        accessState: 'TEACHER_REJECTED',
        canAccessTeacherFeatures: false,
        request: {
          publicReference: 'TR-2026-REJECT',
          status: overrides.status ?? 'REJECTED',
          submittedAt: '2026-01-01T00:00:00.000Z',
          reviewedAt: '2026-01-10T00:00:00.000Z',
          rejectionReason: overrides.rejectionReason ?? null,
          rejectionMode: overrides.rejectionMode ?? null,
          canEditAndResubmit: overrides.canEditAndResubmit ?? false,
        },
        message: 'نأسف، تم رفض طلبك.',
      },
    },
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TeacherRejectedPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherRejectedPage — tracking reference', () => {
  it('renders the tracking reference number', async () => {
    mockGet.mockResolvedValue(buildResponse());
    renderPage();
    expect(await screen.findByText('TR-2026-REJECT')).toBeInTheDocument();
  });

  it('copy button writes reference to clipboard', async () => {
    mockGet.mockResolvedValue(buildResponse());
    renderPage();
    const btn = await screen.findByTitle('auth:copyReference');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TR-2026-REJECT');
    });
  });
});

describe('TeacherRejectedPage — rejection reason', () => {
  it('renders rejection reason when provided', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionReason: 'مستندات غير مكتملة', rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    renderPage();
    expect(await screen.findByText('مستندات غير مكتملة')).toBeInTheDocument();
  });

  it('does not render rejection reason when null', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionReason: null, rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText('auth:rejectionReason')).not.toBeInTheDocument();
    });
  });
});

describe('TeacherRejectedPage — rejection mode behavior', () => {
  it('EDIT_ALLOWED shows the resubmit button', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    renderPage();
    expect(await screen.findByText('auth:editAndResubmit')).toBeInTheDocument();
  });

  it('EDIT_ALLOWED does not show final rejection message', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText('auth:finalRejectionMessage')).not.toBeInTheDocument();
    });
  });

  it('FINAL_REJECTION shows the final message', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'FINAL_REJECTION', canEditAndResubmit: false }));
    renderPage();
    expect(await screen.findByText('auth:finalRejectionMessage')).toBeInTheDocument();
  });

  it('FINAL_REJECTION hides the resubmit button', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'FINAL_REJECTION', canEditAndResubmit: false }));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText('auth:editAndResubmit')).not.toBeInTheDocument();
    });
  });

  it('resubmit button is disabled while mutation is pending', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    mockPost.mockReturnValue(new Promise(() => {})); // never resolves — stays pending
    renderPage();
    const btn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('auth:resubmitting')).toBeInTheDocument();
    });
  });

  it('resubmit navigates to pending-review on success', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    mockPost.mockResolvedValue({ data: { data: { publicReference: 'TR-NEW', status: 'PENDING' } } });
    renderPage();
    const btn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(navigateFn).toHaveBeenCalledWith('/teacher/pending-review');
    });
  });
});
