// @vitest-environment jsdom
// Real i18n — proves the reject-reason textarea rejects whitespace-only
// input and that typing into it never trims mid-composition.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/shared/lib/i18n';
import { AdminTeacherRequestDetailPage } from './AdminTeacherRequestDetailPage';
import { adminTeacherRequestsApi } from '@/features/admin/api/adminTeacherRequests';

vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('@/features/admin/api/adminTeacherRequests', () => ({
  adminTeacherRequestsApi: {
    getDetail: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    getDocumentSignedUrl: vi.fn(),
  },
}));

const mApi = adminTeacherRequestsApi as unknown as {
  getDetail: ReturnType<typeof vi.fn>;
  reject: ReturnType<typeof vi.fn>;
};

function detailFixture() {
  return {
    request: {
      fullName: 'Ahmed Ali',
      email: 'ahmed@example.com',
      mobile: '01012345678',
      publicReference: 'TR-2026-100001',
      status: 'PENDING',
      specialization: 'Chemistry',
      experience: '5 years',
      bio: null,
      adminNotes: null,
    },
    documents: [],
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/teacher-requests/req-1']}>
        <Routes>
          <Route path="/admin/teacher-requests/:requestId" element={<AdminTeacherRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  mApi.getDetail.mockResolvedValue(detailFixture());
  await i18n.changeLanguage('ar');
});
afterEach(() => cleanup());

describe('AdminTeacherRequestDetailPage — reject reason whitespace handling', () => {
  it('3. a spaces-only rejection reason keeps the submit button disabled and shows the required hint', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('رفض الطلب'));

    const textarea = await screen.findByLabelText('سبب الرفض (مطلوب)');
    fireEvent.change(textarea, { target: { value: '     ' } });

    expect(screen.getByText('يجب إدخال سبب الرفض')).toBeInTheDocument();
    expect(screen.getByText('تأكيد الرفض', { selector: 'button' })).toBeDisabled();
    expect(mApi.reject).not.toHaveBeenCalled();
  });

  it('a tab/newline-only rejection reason is likewise rejected', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('رفض الطلب'));

    const textarea = await screen.findByLabelText('سبب الرفض (مطلوب)');
    fireEvent.change(textarea, { target: { value: '\n\t' } });

    expect(screen.getByText('تأكيد الرفض', { selector: 'button' })).toBeDisabled();
  });

  it('a real reason enables submit and is trimmed before sending to the API', async () => {
    mApi.reject.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByText('رفض الطلب'));

    const textarea = await screen.findByLabelText('سبب الرفض (مطلوب)');
    fireEvent.change(textarea, { target: { value: '  Missing documents  ' } });

    const confirmBtn = screen.getByText('تأكيد الرفض', { selector: 'button' });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(mApi.reject).toHaveBeenCalledWith('req-1', { adminNotes: 'Missing documents' }));
  });

  it('8. typing in the reason textarea keeps trailing spaces visible while composing (no per-keystroke trim)', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('رفض الطلب'));

    const textarea = await screen.findByLabelText('سبب الرفض (مطلوب)') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Missing ' } });
    expect(textarea.value).toBe('Missing ');
    fireEvent.change(textarea, { target: { value: 'Missing docs' } });
    expect(textarea.value).toBe('Missing docs');
  });
});
