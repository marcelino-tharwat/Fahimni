// @vitest-environment jsdom
// Regression test for a bug found during the final i18n/whitespace sweep:
// the backend's auth handlers used to hand-roll a `Record<string,string[]>`
// error shape that bypassed `adaptZodError`, which made `translateFieldErrors`
// (a `for...of` over `apiErr.errors`) throw a TypeError instead of rendering
// anything. Now that the backend always returns the stable `{field,code,
// message}[]` shape, this proves the register form actually displays a
// translated per-field error instead of crashing or showing nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/shared/lib/i18n';
import { AuthPage } from './AuthPage';

vi.mock('@/features/subjects/useSubjects', () => ({
  useSubjects: () => ({ subjects: [], loading: false }),
}));
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
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { get: vi.fn(() => Promise.resolve({ data: { data: [{ id: 'stage-1', name: 'Grade 1' }] } })), post: vi.fn() },
}));

function renderAuth() {
  return render(<MemoryRouter initialEntries={['/auth']}><AuthPage /></MemoryRouter>);
}
function goToRegister() {
  fireEvent.click(screen.getByText('إنشاء حساب'));
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('AuthPage register form — server field errors (fixed {field,code,message}[] shape)', () => {
  it('a DUPLICATE_EMAIL error from the backend (array shape) attaches a translated error to the email field, without crashing', async () => {
    await i18n.changeLanguage('ar');
    unwrapMock.mockRejectedValue({
      statusCode: 409,
      code: 'VALIDATION_ERROR',
      message: 'بيانات غير صالحة',
      errors: [{ field: 'email', code: 'DUPLICATE_EMAIL', message: 'Email already registered' }],
    });
    renderAuth();
    goToRegister();

    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: 'Ahmed Ali' } });
    fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'ahmed@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('تأكيد كلمة المرور'), { target: { value: 'Passw0rd!' } });

    fireEvent.click(await screen.findByText('اختر المرحلة'));
    fireEvent.click(await screen.findByText('Grade 1'));

    fireEvent.click(screen.getByText('إنشاء حساب', { selector: 'button[type="submit"]' }));

    await waitFor(() => expect(unwrapMock).toHaveBeenCalled());
    expect(await screen.findByText('البريد الإلكتروني مسجل بالفعل')).toBeInTheDocument();
  });
});
