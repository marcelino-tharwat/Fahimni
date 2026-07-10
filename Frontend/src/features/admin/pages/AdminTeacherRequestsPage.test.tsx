// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminTeacherRequestsPage } from './AdminTeacherRequestsPage';
import { AdminTeacherRequestDetailPage } from './AdminTeacherRequestDetailPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { TeacherRequestForm } from '@/features/teacher-request/components/TeacherRequestForm';
import * as hooks from '@/features/admin/hooks/useAdminTeacherRequests';
import { adminTeacherRequestsApi } from '@/features/admin/api/adminTeacherRequests';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import type {
  AdminTeacherRequestListItem, AdminTeacherRequestDetail, Paginated,
} from '@/features/admin/types/teacherRequests';
import type { AdminStats } from '@/features/admin/types/stats';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown, third?: unknown) => {
      const opts = (typeof second === 'object' ? second : third) as Record<string, unknown> | undefined;
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children?: unknown }) => (children ?? null) as never,
}));

vi.mock('@/features/admin/hooks/useAdminTeacherRequests', () => ({
  useAdminTeacherRequests: vi.fn(),
  useAdminTeacherRequestDetail: vi.fn(),
  useApproveTeacherRequest: vi.fn(),
  useRejectTeacherRequest: vi.fn(),
}));
vi.mock('@/features/admin/api/adminTeacherRequests', () => ({
  adminTeacherRequestsApi: { getDocumentSignedUrl: vi.fn() },
}));
vi.mock('@/features/admin/hooks/useAdminStats', () => ({ useAdminStats: vi.fn() }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));

const m = hooks as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mApi = adminTeacherRequestsApi as unknown as { getDocumentSignedUrl: ReturnType<typeof vi.fn> };
const mStats = useAdminStats as unknown as ReturnType<typeof vi.fn>;

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

function item(overrides: Partial<AdminTeacherRequestListItem> = {}): AdminTeacherRequestListItem {
  return {
    id: 'r1', publicReference: 'TR-2026-100001', status: 'PENDING',
    fullName: 'Applicant One', email: 'a1@x.local', mobile: '01000000001',
    specialization: 'Math', createdAt: '2026-01-01T00:00:00.000Z', reviewedAt: null, reviewedBy: null,
    ...overrides,
  };
}
function list(items: AdminTeacherRequestListItem[]): Paginated<AdminTeacherRequestListItem> {
  return { data: items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } };
}

const DETAIL: AdminTeacherRequestDetail = {
  request: {
    id: 'r1', publicReference: 'TR-2026-100001', status: 'PENDING',
    fullName: 'Applicant One', email: 'a1@x.local', mobile: '01000000001',
    specialization: 'Math', experience: null, bio: 'A short bio', adminNotes: null,
    createdAt: '2026-01-01T00:00:00.000Z', reviewedAt: null,
  },
  documents: [{ index: 0, fileName: 'certificate.pdf', mimeType: 'application/pdf', size: 12345, previewType: 'PDF', status: 'AVAILABLE' }],
  reviewedBy: null,
};

function primeList(data = list([item()])) {
  m.useAdminTeacherRequests.mockReturnValue(ok(data));
}
const approveMutate = vi.fn();
const rejectMutate = vi.fn();
function primeDetail(detail = DETAIL) {
  m.useAdminTeacherRequestDetail.mockReturnValue(ok(detail));
  m.useApproveTeacherRequest.mockReturnValue({ mutate: approveMutate, isPending: false });
  m.useRejectTeacherRequest.mockReturnValue({ mutate: rejectMutate, isPending: false });
}

function renderList() {
  return render(<MemoryRouter><AdminTeacherRequestsPage /></MemoryRouter>);
}
function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/admin/teacher-requests/r1']}>
      <Routes><Route path="/admin/teacher-requests/:requestId" element={<AdminTeacherRequestDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); primeList(); primeDetail(); (window.open as unknown) = vi.fn(); });
afterEach(() => cleanup());

describe('AdminTeacherRequestsPage (list)', () => {
  it('1. list page renders with API rows', () => {
    renderList();
    expect(screen.getByText('adminTeacherRequests.title')).toBeInTheDocument();
    expect(screen.getByText('Applicant One')).toBeInTheDocument();
    expect(screen.getByText('TR-2026-100001')).toBeInTheDocument();
  });

  it('2. status filter updates the query', async () => {
    renderList();
    // Scope to the filter group so the row's own status badge doesn't collide.
    const group = screen.getByRole('group', { name: 'adminTeacherRequests.statusFilter' });
    fireEvent.click(within(group).getByText('adminTeacherRequests.status.PENDING'));
    await waitFor(() =>
      expect(m.useAdminTeacherRequests).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' })),
    );
  });

  it('3. search updates the query (debounced)', async () => {
    renderList();
    fireEvent.change(screen.getByLabelText('adminTeacherRequests.searchPlaceholder'), { target: { value: 'TR-2026' } });
    await waitFor(() =>
      expect(m.useAdminTeacherRequests).toHaveBeenCalledWith(expect.objectContaining({ q: 'TR-2026' })),
    );
  });

  it('12. loading and error states render', () => {
    m.useAdminTeacherRequests.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: false, refetch: vi.fn() });
    const { unmount } = renderList();
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();
    m.useAdminTeacherRequests.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });
    renderList();
    expect(screen.getByText('adminTeacherRequests.errorLoading')).toBeInTheDocument();
  });

  it('empty state renders', () => {
    m.useAdminTeacherRequests.mockReturnValue(ok(list([])));
    renderList();
    expect(screen.getByText('adminTeacherRequests.emptyTitle')).toBeInTheDocument();
  });
});

describe('AdminTeacherRequestDetailPage', () => {
  it('4. detail page renders applicant info + reference', () => {
    renderDetail();
    expect(screen.getByText('Applicant One')).toBeInTheDocument();
    expect(screen.getByText('TR-2026-100001')).toBeInTheDocument();
    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
  });

  it('5. approve modal confirms and calls the approve mutation', () => {
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.approve'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByText('adminTeacherRequests.detail.confirmApprove'));
    expect(approveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ createAccount: true }),
      expect.any(Object),
    );
  });

  it('6 & 7. reject modal requires admin notes then calls the reject mutation', () => {
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.reject'));
    const dialog = screen.getByRole('dialog');
    // With empty notes, the confirm button is disabled and the required hint shows.
    const confirm = within(dialog).getByText('adminTeacherRequests.detail.confirmReject');
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByText('adminTeacherRequests.detail.rejectNotesRequired')).toBeInTheDocument();
    // Fill notes → enabled → calls reject.
    fireEvent.change(within(dialog).getByLabelText('adminTeacherRequests.detail.rejectNotesLabel'), { target: { value: 'not enough proof' } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(rejectMutate).toHaveBeenCalledWith({ adminNotes: 'not enough proof', rejectionMode: 'EDIT_ALLOWED' }, expect.any(Object));
  });

  it('reject modal textarea is the initially focused element', async () => {
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.reject'));
    await waitFor(() => {
      const textarea = screen.getByLabelText('adminTeacherRequests.detail.rejectNotesLabel');
      expect(textarea).toHaveFocus();
    });
  });

  it('reject modal focus stays in textarea while typing', async () => {
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.reject'));
    const textarea = await screen.findByLabelText('adminTeacherRequests.detail.rejectNotesLabel');
    // Focus the textarea explicitly for the test typing
    textarea.focus();
    expect(textarea).toHaveFocus();

    for (const char of ['a', 'b', 'c']) {
      fireEvent.change(textarea, { target: { value: (textarea as HTMLTextAreaElement).value + char } });
      expect(textarea).toHaveFocus();
    }
  });

  it('reject modal close button never steals focus while typing', () => {
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.reject'));
    const textarea = screen.getByLabelText('adminTeacherRequests.detail.rejectNotesLabel');
    textarea.focus();
    // Simulate typing the first character (which triggers parent re-render via setRejectNotes)
    fireEvent.change(textarea, { target: { value: 'a' } });
    // After re-render the textarea must still have focus
    expect(textarea).toHaveFocus();
  });

  it('8a. document open triggers the signed-url flow', async () => {
    mApi.getDocumentSignedUrl.mockResolvedValue({ url: 'https://signed.example/doc', expiresIn: 300 });
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.openDocument'));
    await waitFor(() => expect(mApi.getDocumentSignedUrl).toHaveBeenCalledWith('r1', 0));
  });

  it('8b. unavailable document renders the safe message', async () => {
    mApi.getDocumentSignedUrl.mockRejectedValue(new Error('DOCUMENT_UNAVAILABLE'));
    renderDetail();
    fireEvent.click(screen.getByText('adminTeacherRequests.detail.openDocument'));
    await waitFor(() =>
      expect(screen.getByText('adminTeacherRequests.detail.documentUnavailable')).toBeInTheDocument(),
    );
  });

  it('9. raw proof document storage path is never rendered', () => {
    renderDetail();
    // Only the safe fileName is shown — no storage key / path.
    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/teacher-registration-requests\//)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SECRET|storageKey|"path"/i);
  });

  it('detail error state renders', () => {
    m.useAdminTeacherRequestDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });
    renderDetail();
    expect(screen.getByText('adminTeacherRequests.detail.error')).toBeInTheDocument();
  });
});

describe('navigation & public form', () => {
  const stats: AdminStats = {
    users: { totalTeachers: 0, activeTeachers: 0, totalStudents: 0, activeStudents: 0, studentsWithoutTeacher: 0, studentsWithoutAnyEnrollment: 0 },
    content: { totalStages: 0, totalChapters: 0, totalLessons: 0, totalMaterials: 0, totalQuizzes: 0, publishedQuizzes: 0, draftQuizzes: 0 },
    learning: { totalEnrollments: 0, activeEnrollments: 0, pendingEnrollments: 0, quizAttempts: 0, averageQuizScore: 0 },
    finance: { confirmedCourseRevenue: 0, confirmedTeacherSubscriptionRevenue: 0, totalConfirmedRevenue: 0, monthlyConfirmedRevenue: 0, estimatedSubscriptionRevenue: 0, currency: 'EGP', reliabilityWarnings: [] },
    operations: { pendingTeacherRequests: 4, activeTeacherSubscriptions: 0, pendingTeacherSubscriptionRequests: 0, pendingTeacherSubscriptionPayments: 0, failedTeacherSubscriptionPayments: 0 },
    ai: { quizGenerations: 0, essayGrading: 0, totalAiEvents: 0 },
    topTeachers: { byRevenue: [], byStudents: [] },
  };

  it('10. sidebar links Teacher Requests to /admin/teacher-requests', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, '../../../shared/components/layout/AdminLayout.tsx'), 'utf8');
    expect(src).toMatch(/path:\s*'\/admin\/teacher-requests'/);
    expect(src).toMatch(/nav\.teacherRequests/);
  });

  it('11. dashboard pending-requests card links to /admin/teacher-requests', () => {
    mStats.mockReturnValue({ data: stats, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false });
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /adminDashboard\.pendingTeacherRequests/ });
    expect(link).toHaveAttribute('href', '/admin/teacher-requests');
  });

  it('13. public teacher registration form still renders', () => {
    render(<MemoryRouter><TeacherRequestForm /></MemoryRouter>);
    // A submit control is present (form still works).
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
