// @vitest-environment jsdom
// Regression tests for the per-role login gating bug: a manually-registered
// teacher (ali@gmail.com) got a permanent 403 EMAIL_NOT_VERIFIED because the
// backend incorrectly required email verification for teachers too. The
// backend fix (registerTeacherPending: emailVerified:true) means teachers now
// reach the *already-correct* pending/rejected/approved handling below
// instead of being blocked earlier by the email-verification gate. These
// tests lock in that the frontend maps every known login outcome to a
// specific message/redirect — never the generic "Something went wrong".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/shared/lib/i18n';
import { AuthPage } from './AuthPage';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: () => vi.fn(),
}));
vi.mock('@/shared/components/layout/AppHeader', () => ({ AppHeader: () => null }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const unwrapMock = vi.fn();
const dispatchMock = vi.fn(() => ({ unwrap: unwrapMock }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => dispatchMock, useAppSelector: () => undefined }));
vi.mock('@/features/auth/store/authSlice', () => ({
  login: vi.fn(() => ({ type: 'login' })),
  register: vi.fn(() => ({ type: 'register' })),
  googleLogin: vi.fn(() => ({ type: 'google' })),
  dashboardPathByRole: { STUDENT: '/student/dashboard', OPERATION: '/teacher/dashboard', ADMIN: '/admin/dashboard' },
}));

function renderAuth() {
  return render(<MemoryRouter initialEntries={['/auth']}><AuthPage /></MemoryRouter>);
}

async function submitLogin() {
  fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: 'Str0ng!Pass' } });
  fireEvent.click(screen.getByText('تسجيل الدخول', { selector: 'button[type="submit"]' }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('ar');
});
afterEach(() => cleanup());

describe('Login — per-role outcomes never fall back to a generic "Something went wrong"', () => {
  it('1. EMAIL_NOT_VERIFIED redirects to the verification-pending screen (not shown as a form error)', async () => {
    unwrapMock.mockRejectedValue({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' });
    renderAuth();
    await submitLogin();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/verify-email-pending', { state: { email: 'user@example.com' } }),
    );
    // No generic error banner should render — the redirect handles it.
    expect(screen.queryByText('حدث خطأ، برجاء المحاولة مرة أخرى')).not.toBeInTheDocument();
  });

  it('2. a pending teacher (accessState: TEACHER_PENDING_REVIEW) succeeds and redirects to the pending-review page — never blocked, never a generic error', async () => {
    unwrapMock.mockResolvedValue({
      user: { role: 'OPERATION' },
      accessState: 'TEACHER_PENDING_REVIEW',
    });
    renderAuth();
    await submitLogin();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/teacher/pending-review'));
    expect(screen.queryByText('حدث خطأ، برجاء المحاولة مرة أخرى')).not.toBeInTheDocument();
  });

  it('3. a rejected teacher (accessState: TEACHER_REJECTED) succeeds and redirects to the rejected page', async () => {
    unwrapMock.mockResolvedValue({
      user: { role: 'OPERATION' },
      accessState: 'TEACHER_REJECTED',
    });
    renderAuth();
    await submitLogin();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/teacher/rejected'));
  });

  it('4. an approved teacher (no special accessState) redirects to the normal teacher dashboard', async () => {
    unwrapMock.mockResolvedValue({
      user: { role: 'OPERATION' },
      accessState: 'FREE_TEACHER',
    });
    renderAuth();
    await submitLogin();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/teacher/dashboard'));
  });

  it('5. a truly unknown error code falls back to the real (Arabic, i18n) generic message — not a hardcoded English string', async () => {
    unwrapMock.mockRejectedValue({ statusCode: 500, code: 'SOME_UNMAPPED_CODE', message: 'raw backend text' });
    renderAuth();
    await submitLogin();

    expect(await screen.findByText('حدث خطأ، برجاء المحاولة مرة أخرى')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).not.toBeInTheDocument();
  });
});
