// @vitest-environment jsdom
// Real i18n (no react-i18next mock) — proves the login form rejects a
// whitespace-only password client-side and renders API errors via
// `translateApiError` (in the current UI language), not `String(err)`
// (a bug found during the final i18n/whitespace sweep — see
// VALIDATION_I18N_WHITESPACE_FINAL_SWEEP_REPORT.md).
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

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('AuthPage login form — whitespace-only password rejected', () => {
  it('Arabic UI: a whitespace/tab-only password shows the required-password message and never dispatches', async () => {
    await i18n.changeLanguage('ar');
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: '\t   \t' } });
    fireEvent.click(screen.getByText('تسجيل الدخول', { selector: 'button[type="submit"]' }));

    expect(await screen.findByText('كلمة المرور مطلوبة')).toBeInTheDocument();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('English UI: same whitespace-only password is rejected with the English message', async () => {
    await i18n.changeLanguage('en');
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: '     ' } });
    fireEvent.click(screen.getByText('Sign In', { selector: 'button[type="submit"]' }));

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('AuthPage login form — API errors render via translateApiError, in the current UI language', () => {
  it('Arabic UI: an INVALID_CREDENTIALS error renders the Arabic translation, never "[object Object]" or a raw English string', async () => {
    await i18n.changeLanguage('ar');
    unwrapMock.mockRejectedValue({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByText('تسجيل الدخول', { selector: 'button[type="submit"]' }));

    expect(await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة')).toBeInTheDocument();
    expect(screen.queryByText(/object Object/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid email or password/)).not.toBeInTheDocument();
  });

  it('English UI: the same error code renders the English translation', async () => {
    await i18n.changeLanguage('en');
    unwrapMock.mockRejectedValue({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByText('Sign In', { selector: 'button[type="submit"]' }));

    await waitFor(() => expect(unwrapMock).toHaveBeenCalled());
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.queryByText(/object Object/)).not.toBeInTheDocument();
  });
});
