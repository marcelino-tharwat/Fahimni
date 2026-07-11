// @vitest-environment jsdom
// Real i18n (no react-i18next mock) so the "validation messages follow the
// current language" requirement is actually exercised end-to-end, not just
// asserted against a mocked key echo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/shared/lib/i18n';
import { AuthPage } from './AuthPage';
import { apiClient } from '@/shared/lib/api/client';

vi.mock('@/features/subjects/useSubjects', () => ({
  useSubjects: () => ({
    subjects: [{ code: 'CHEM', displayName: 'الكيمياء', isActive: true }],
    loading: false,
  }),
}));
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: () => vi.fn(),
}));
vi.mock('@/shared/components/layout/AppHeader', () => ({ AppHeader: () => null }));
const dispatchMock = vi.fn(() => ({ unwrap: () => Promise.resolve({ user: { role: 'STUDENT' } }) }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => dispatchMock, useAppSelector: () => undefined }));
vi.mock('@/features/auth/store/authSlice', () => ({
  login: vi.fn(() => ({ type: 'login' })),
  register: vi.fn(() => ({ type: 'register' })),
  googleLogin: vi.fn(() => ({ type: 'google' })),
  dashboardPathByRole: { STUDENT: '/student/dashboard', OPERATION: '/teacher/dashboard', ADMIN: '/admin/dashboard' },
}));
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(() => Promise.resolve({ data: {} })) },
}));

const mApi = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

function renderAuth() {
  return render(<MemoryRouter initialEntries={['/auth']}><AuthPage /></MemoryRouter>);
}
function goToRegister() {
  // Before switching tabs, only the tab button itself has this text (the
  // register form + its own same-labeled submit button aren't mounted yet).
  fireEvent.click(screen.getByText('إنشاء حساب'));
}
function clickSubmit() {
  // Once on the register tab, the tab button AND the submit button share the
  // same Arabic label ("إنشاء حساب") — disambiguate by type.
  fireEvent.click(screen.getByText('إنشاء حساب', { selector: 'button[type="submit"]' }));
}
function fillCommonRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'stud@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '01012345678' } });
  fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: 'Passw0rd!' } });
  fireEvent.change(screen.getByPlaceholderText('تأكيد كلمة المرور'), { target: { value: 'Passw0rd!' } });
}

beforeEach(async () => {
  vi.clearAllMocks();
  mApi.get.mockResolvedValue({ data: { data: [] } });
  mApi.post.mockResolvedValue({ data: {} });
  await i18n.changeLanguage('ar');
});
afterEach(() => cleanup());

describe('AuthPage register form — whitespace/tab-only input rejected (Arabic UI)', () => {
  it('1 & 2 & 7. a tab-only full name shows the real Arabic "too short" validation message on submit', async () => {
    renderAuth();
    goToRegister();
    fillCommonRequiredFields();
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: '\t\t' } });
    clickSubmit();

    expect(await screen.findByText('الاسم يجب أن يكون حرفين على الأقل')).toBeInTheDocument();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('2. a spaces-only full name is rejected the same way', async () => {
    renderAuth();
    goToRegister();
    fillCommonRequiredFields();
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: '      ' } });
    clickSubmit();

    expect(await screen.findByText('الاسم يجب أن يكون حرفين على الأقل')).toBeInTheDocument();
  });

  it('4 & 5. a valid teacher submission trims fullName before sending to the API', async () => {
    // The teacher path submits directly via apiClient (no stage selection
    // required), so it's the reliable way to observe the real submitted
    // payload end-to-end, same convention as this file's sibling test suite.
    // (email/mobile are covered separately: their own anchored regex
    // patterns already reject surrounding whitespace before submit is even
    // reachable, so there's nothing extra to observe for those two fields.)
    renderAuth();
    goToRegister();
    fireEvent.click(screen.getByText('مدرس'));
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: '  Ahmed Ali  ' } });
    fireEvent.change(screen.getByPlaceholderText('البريد الإلكتروني'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('كلمة المرور'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('تأكيد كلمة المرور'), { target: { value: 'Passw0rd!' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'التخصص' }));
    fireEvent.click(screen.getByRole('option', { name: 'الكيمياء' }));
    clickSubmit();

    await waitFor(() => expect(mApi.post).toHaveBeenCalled());
    const fd = mApi.post.mock.calls.at(-1)![1] as FormData;
    expect(fd.get('fullName')).toBe('Ahmed Ali');
    expect(fd.get('email')).toBe('teacher@example.com');
    expect(fd.get('mobile')).toBe('01012345678');
  });

  it('8. typing in the full-name field keeps leading/trailing spaces visible while composing (no per-keystroke trim)', () => {
    renderAuth();
    goToRegister();
    const input = screen.getByPlaceholderText('الاسم الكامل') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ahmed ' } });
    expect(input.value).toBe('Ahmed ');
    fireEvent.change(input, { target: { value: 'Ahmed A' } });
    expect(input.value).toBe('Ahmed A');
  });
});

describe('AuthPage register form — same behavior in English UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('1 & 7. a tab-only full name shows the real English validation message', async () => {
    renderAuth();
    fireEvent.click(screen.getByText('Register', { selector: 'button' }));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'stud@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mobile Number'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: '\t\t' } });
    fireEvent.click(screen.getByText('Create Account', { selector: 'button[type="submit"]' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
  });
});
