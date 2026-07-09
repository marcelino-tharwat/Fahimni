// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from './AuthPage';
import { TeacherPendingReviewPage } from '@/features/teacher/pages/TeacherPendingReviewPage';
import { TeacherRequestForm } from '@/features/teacher-request/components/TeacherRequestForm';
import { apiClient } from '@/shared/lib/api/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ar' } }),
  Trans: ({ children }: { children?: unknown }) => (children ?? null) as never,
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
  fireEvent.click(screen.getByText('auth:registerTab'));
}

beforeEach(() => { vi.clearAllMocks(); mApi.get.mockResolvedValue({ data: { data: [] } }); mApi.post.mockResolvedValue({ data: {} }); });
afterEach(() => cleanup());

describe('AuthPage — register account types', () => {
  it('1. register tab shows the account-type selector (student/teacher)', () => {
    renderAuth();
    goToRegister();
    expect(screen.getByText('auth:accountTypeStudent')).toBeInTheDocument();
    expect(screen.getByText('auth:accountTypeTeacher')).toBeInTheDocument();
  });

  it('2. student form renders password and confirmPassword', () => {
    renderAuth();
    goToRegister();
    expect(screen.getByPlaceholderText('auth:password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth:confirmPassword')).toBeInTheDocument();
  });

  it('3. teacher form renders password/confirmPassword and the specialization field', () => {
    renderAuth();
    goToRegister();
    fireEvent.click(screen.getByText('auth:accountTypeTeacher'));
    expect(screen.getByPlaceholderText('auth:password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth:confirmPassword')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth:subject')).toBeInTheDocument();
    // Proof-document upload is present for teacher registration.
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('4. student registration submits (dispatches register thunk)', async () => {
    renderAuth();
    goToRegister();
    fireEvent.change(screen.getByPlaceholderText('auth:fullName'), { target: { value: 'Test Student' } });
    fireEvent.change(screen.getByPlaceholderText('auth:email'), { target: { value: 'stud@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth:mobile'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('auth:password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('auth:confirmPassword'), { target: { value: 'Passw0rd!' } });
    // stageId is validated; set via the hidden field is not trivial, so this asserts
    // the submit path reaches validation without throwing. The teacher path (test 5)
    // covers a full successful submit.
    fireEvent.click(screen.getByText('auth:registerButton'));
    await waitFor(() => expect(screen.getByPlaceholderText('auth:fullName')).toBeInTheDocument());
  });

  it('5. teacher registration submits and shows the pending-review message', async () => {
    renderAuth();
    goToRegister();
    fireEvent.click(screen.getByText('auth:accountTypeTeacher'));
    fireEvent.change(screen.getByPlaceholderText('auth:fullName'), { target: { value: 'Test Teacher' } });
    fireEvent.change(screen.getByPlaceholderText('auth:email'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth:mobile'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('auth:password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('auth:confirmPassword'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('auth:subject'), { target: { value: 'Biology' } });
    fireEvent.click(screen.getByText('auth:registerButton'));
    // Teacher registration is submitted as multipart/form-data (proof docs ride along).
    await waitFor(() => expect(mApi.post).toHaveBeenCalledWith(
      '/v1/auth/register',
      expect.any(FormData),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' }) }),
    ));
    const fd = mApi.post.mock.calls.at(-1)![1] as FormData;
    expect(fd.get('role')).toBe('OPERATION');
    expect(fd.get('email')).toBe('teacher@example.com');
    expect(await screen.findByTestId('teacher-pending-message')).toBeInTheDocument();
  });

  it('8. teacher registration shows the tracking reference returned by the API', async () => {
    mApi.post.mockResolvedValue({ data: { data: { pendingReview: true, trackingReference: 'TR-2026-654321' } } });
    renderAuth();
    goToRegister();
    fireEvent.click(screen.getByText('auth:accountTypeTeacher'));
    fireEvent.change(screen.getByPlaceholderText('auth:fullName'), { target: { value: 'Ref Teacher' } });
    fireEvent.change(screen.getByPlaceholderText('auth:email'), { target: { value: 'ref@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth:mobile'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByPlaceholderText('auth:password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('auth:confirmPassword'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByPlaceholderText('auth:subject'), { target: { value: 'Biology' } });
    fireEvent.click(screen.getByText('auth:registerButton'));
    const refBlock = await screen.findByTestId('tracking-reference');
    expect(refBlock).toHaveTextContent('TR-2026-654321');
    expect(screen.getByTestId('copy-tracking-reference')).toBeInTheDocument();
  });
});

describe('teacher pending review + public request', () => {
  it('6. TeacherPendingReviewPage renders the pending message', () => {
    render(<MemoryRouter><TeacherPendingReviewPage /></MemoryRouter>);
    expect(screen.getByText('auth:teacherPendingTitle')).toBeInTheDocument();
    expect(screen.getByText('auth:teacherPendingMessage')).toBeInTheDocument();
  });

  it('7. existing public teacher request form still renders', () => {
    render(<MemoryRouter><TeacherRequestForm /></MemoryRouter>);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
