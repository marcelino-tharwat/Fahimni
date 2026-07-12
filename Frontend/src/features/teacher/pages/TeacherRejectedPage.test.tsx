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
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  subject: string | null;
  bio: string | null;
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
          fullName: overrides.fullName ?? 'أحمد محمد',
          email: overrides.email ?? 'ahmed@test.com',
          mobile: overrides.mobile ?? '01012345678',
          subject: overrides.subject ?? 'الرياضيات',
          bio: overrides.bio ?? 'مدرس رياضيات خبرة 5 سنوات',
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
  it('EDIT_ALLOWED shows the edit button', async () => {
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

  it('FINAL_REJECTION hides the edit button', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'FINAL_REJECTION', canEditAndResubmit: false }));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText('auth:editAndResubmit')).not.toBeInTheDocument();
    });
  });
});

describe('TeacherRejectedPage — edit form flow', () => {
  it('clicking edit shows the form with all fields prefilled', async () => {
    mockGet.mockResolvedValue(buildResponse({
      rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true,
      fullName: 'أحمد محمد', email: 'ahmed@test.com', mobile: '01012345678', subject: 'الرياضيات', bio: 'مدرس رياضيات',
    }));
    renderPage();
    const editBtn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(editBtn);

    expect(await screen.findByText('auth:editRequestTitle')).toBeInTheDocument();

    // Section headings
    expect(screen.getByText('auth:personalInfo')).toBeInTheDocument();
    expect(screen.getByText('auth:professionalInfo')).toBeInTheDocument();

    // All fields prefilled — personal info
    expect(screen.getByDisplayValue('أحمد محمد')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ahmed@test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('01012345678')).toBeInTheDocument();

    // All fields prefilled — professional info
    const select = screen.getByDisplayValue('الرياضيات');
    expect(select).toBeInTheDocument();
    expect(screen.getByDisplayValue('مدرس رياضيات')).toBeInTheDocument();
  });

  it('changing a field and submitting sends updated data to resubmit', async () => {
    mockGet.mockResolvedValue(buildResponse({
      rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true,
      fullName: 'أحمد محمد', email: 'ahmed@test.com', mobile: '01012345678', subject: 'الرياضيات', bio: 'مدرس رياضيات',
    }));
    mockPost.mockResolvedValue({ data: { data: { publicReference: 'TR-NEW', status: 'PENDING' } } });
    renderPage();

    const editBtn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(editBtn);

    const nameInput = screen.getByDisplayValue('أحمد محمد') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'أحمد محمد علي' } });

    const emailInput = screen.getByDisplayValue('ahmed@test.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'ahmed.updated@test.com' } });

    const submitBtn = screen.getByText('auth:sendEdits');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/teachers/registration-request/resubmit', {
        fullName: 'أحمد محمد علي',
        email: 'ahmed.updated@test.com',
        mobile: '01012345678',
        subject: 'الرياضيات',
        bio: 'مدرس رياضيات',
      });
    });
  });

  it('cancel returns to the initial state', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    renderPage();

    const editBtn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(editBtn);

    expect(await screen.findByText('auth:editRequestTitle')).toBeInTheDocument();

    const cancelBtn = screen.getByText('actions.cancel');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('auth:editRequestTitle')).not.toBeInTheDocument();
    });
    expect(screen.getByText('auth:editAndResubmit')).toBeInTheDocument();
  });

  it('submit navigates to pending-review on success', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    mockPost.mockResolvedValue({ data: { data: { publicReference: 'TR-NEW', status: 'PENDING' } } });
    renderPage();

    const editBtn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(editBtn);

    const submitBtn = screen.getByText('auth:sendEdits');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(navigateFn).toHaveBeenCalledWith('/teacher/pending-review');
    });
  });

  it('submit button is disabled while mutation is pending', async () => {
    mockGet.mockResolvedValue(buildResponse({ rejectionMode: 'EDIT_ALLOWED', canEditAndResubmit: true }));
    mockPost.mockReturnValue(new Promise(() => {}));
    renderPage();

    const editBtn = await screen.findByText('auth:editAndResubmit');
    fireEvent.click(editBtn);

    const submitBtn = screen.getByText('auth:sendEdits');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('auth:resubmitting')).toBeInTheDocument();
    });
  });
});
