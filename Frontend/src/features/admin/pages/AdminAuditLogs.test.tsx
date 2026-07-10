// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminAuditLogsPage } from './AdminAuditLogsPage';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import * as hooks from '@/features/admin/hooks/useAdminAuditLogs';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: 'ar' } }) }));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('@/shared/components/layout/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('@/features/admin/hooks/useAdminAuditLogs');

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false } as never);

const LOG = {
  id: 'log-1',
  action: 'ADMIN_PLAN_CREATED',
  entityType: 'TeacherPlan',
  entityId: 'plan-1',
  actor: { id: 'admin-1', fullName: 'Admin One', email: 'admin@x.local' },
  actorType: 'ADMIN',
  // Metadata is already sanitised by the server (secrets stripped/redacted).
  metadata: { code: 'PRO', monthlyPrice: 499, nested: { authorization: '[REDACTED]', safe: 'ok' } },
  createdAt: '2026-01-01T00:00:00Z',
};

function prime() {
  vi.mocked(hooks.useAuditLogs).mockReturnValue(
    ok({ data: [LOG], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
  );
  vi.mocked(hooks.useAuditFilterOptions).mockReturnValue(
    ok({ actions: ['ADMIN_PLAN_CREATED', 'USER_CREATED'], entityTypes: ['TeacherPlan', 'User'] }),
  );
}

beforeEach(() => { vi.clearAllMocks(); prime(); });
afterEach(() => cleanup());

const renderPage = () => render(<MemoryRouter><AdminAuditLogsPage /></MemoryRouter>);

describe('AdminAuditLogsPage', () => {
  it('1. renders the audit logs page', () => {
    renderPage();
    expect(screen.getByTestId('admin-audit-logs-page')).toBeInTheDocument();
  });

  it('2. renders the filters (actor/action/entity/date range)', () => {
    renderPage();
    expect(screen.getByTestId('audit-filters')).toBeInTheDocument();
    expect(screen.getByTestId('filter-actor')).toBeInTheDocument();
    expect(screen.getByTestId('filter-action')).toBeInTheDocument();
    expect(screen.getByTestId('filter-entity')).toBeInTheDocument();
    expect(screen.getByTestId('filter-date-from')).toBeInTheDocument();
    expect(screen.getByTestId('filter-date-to')).toBeInTheDocument();
  });

  it('3. renders the table with rows', () => {
    renderPage();
    expect(screen.getByTestId('audit-logs-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('audit-row').length).toBe(1);
  });

  it('4 & 5. detail drawer renders sanitized metadata', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('audit-view-btn'));
    await waitFor(() => expect(screen.getByTestId('audit-detail-drawer')).toBeInTheDocument());
    const md = screen.getByTestId('audit-metadata');
    expect(md).toHaveTextContent('PRO');
    expect(md).toHaveTextContent('[REDACTED]');
  });

  it('6. no secret values are visible in the rendered page', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByTestId('audit-view-btn'));
    expect(container.innerHTML).not.toMatch(/password|rawCallback|checkoutUrl|resetToken|Bearer /i);
  });
});

describe('Admin sidebar', () => {
  it('7. sidebar links Audit Logs to /admin/audit-logs', () => {
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: 'nav.auditLogs' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/admin/audit-logs'));
  });
});
