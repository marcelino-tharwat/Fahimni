import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, X, Search } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { useDirection } from '@/shared/hooks/useDirection';
import { useAuditLogs, useAuditFilterOptions } from '@/features/admin/hooks/useAdminAuditLogs';
import type { AuditLog, AuditLogsQuery } from '@/features/admin/types/auditLogs';

const LIMIT = 20;

/** Locale used for date formatting, derived from the active UI language. */
function useDateLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar-EG' : 'en-US';
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

function DetailDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const { t } = useTranslation();
  const dir = useDirection();
  const locale = useDateLocale();
  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/40" onClick={onClose} data-testid="audit-detail-drawer">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-modal" dir={dir} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-cairo text-lg font-bold text-navy-900">{t('auditLogs.detailTitle')}</h3>
          <button type="button" onClick={onClose} className="rounded-btn p-1.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <dl className="flex flex-col gap-3 font-cairo text-sm">
          <Row label={t('auditLogs.colAction')}><Badge variant="cyan">{log.action}</Badge></Row>
          <Row label={t('auditLogs.entityType')}>{log.entityType}</Row>
          <Row label={t('auditLogs.entityId')}><span className="font-mono text-xs">{log.entityId}</span></Row>
          <Row label={t('auditLogs.actor')}>{log.actor ? `${log.actor.fullName} · ${log.actor.email}` : (log.actorType ?? '—')}</Row>
          <Row label={t('auditLogs.date')}>{new Date(log.createdAt).toLocaleString(locale)}</Row>
        </dl>
        <div className="mt-4">
          <p className="mb-1 font-cairo text-sm font-semibold text-text-primary">{t('auditLogs.metadata')}</p>
          <pre data-testid="audit-metadata" className="max-h-80 overflow-auto rounded-lg border border-border bg-gray-50 p-3 text-start font-mono text-xs text-navy-900" dir="ltr">
            {JSON.stringify(log.metadata ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{children}</dd>
    </div>
  );
}

export function AdminAuditLogsPage() {
  const { t } = useTranslation();
  const dir = useDirection();
  const locale = useDateLocale();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const query = useMemo<AuditLogsQuery>(
    () => ({
      page,
      limit: LIMIT,
      ...(q ? { q } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    [q, action, entityType, dateFrom, dateTo, page],
  );

  const { data, isLoading, isError } = useAuditLogs(query);
  const { data: options } = useAuditFilterOptions();
  const rows = (data?.data ?? []) as AuditLog[];
  const totalPages = data?.meta.totalPages ?? 1;

  const resetPage = () => setPage(1);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir={dir} data-testid="admin-audit-logs-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('auditLogs.title')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('auditLogs.subtitle')}</p>
      </div>

      {/* Filters — each control is labelled; the two date fields form a "from / to"
          date range so it's clear they aren't two separate calendars. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" data-testid="audit-filters">
        <label className="flex flex-col gap-1">
          <span className="font-cairo text-xs font-medium text-text-secondary">{t('auditLogs.search')}</span>
          <span className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-3 text-text-muted" />
            <input
              data-testid="filter-actor"
              value={q}
              onChange={(e) => { setQ(e.target.value); resetPage(); }}
              placeholder={t('auditLogs.searchPlaceholder')}
              className="h-10 w-52 rounded-input border border-border bg-surface ps-3 pe-9 font-cairo text-sm outline-none focus:border-accent"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-cairo text-xs font-medium text-text-secondary">{t('auditLogs.action')}</span>
          <select data-testid="filter-action" value={action} onChange={(e) => { setAction(e.target.value); resetPage(); }}
            className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm">
            <option value="">{t('auditLogs.allActions')}</option>
            {(options?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-cairo text-xs font-medium text-text-secondary">{t('auditLogs.entityType')}</span>
          <select data-testid="filter-entity" value={entityType} onChange={(e) => { setEntityType(e.target.value); resetPage(); }}
            className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm">
            <option value="">{t('auditLogs.allEntities')}</option>
            {(options?.entityTypes ?? []).map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </label>

        {/* Date range: from → to */}
        <div className="flex items-end gap-2 rounded-lg border border-border/60 bg-gray-50/60 px-2 py-1.5" data-testid="audit-date-range">
          <label className="flex flex-col gap-1">
            <span className="font-cairo text-xs font-medium text-text-secondary">{t('auditLogs.fromDate')}</span>
            <input type="date" data-testid="filter-date-from" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
              className="h-9 rounded-input border border-border bg-surface px-3 font-cairo text-sm" />
          </label>
          <span className="pb-2 font-cairo text-text-muted">→</span>
          <label className="flex flex-col gap-1">
            <span className="font-cairo text-xs font-medium text-text-secondary">{t('auditLogs.toDate')}</span>
            <input type="date" data-testid="filter-date-to" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
              className="h-9 rounded-input border border-border bg-surface px-3 font-cairo text-sm" />
          </label>
        </div>

        {(q || action || entityType || dateFrom || dateTo) && (
          <button
            type="button"
            data-testid="clear-filters"
            onClick={() => { setQ(''); setAction(''); setEntityType(''); setDateFrom(''); setDateTo(''); resetPage(); }}
            className="h-10 rounded-btn border border-border px-3 font-cairo text-sm text-text-secondary hover:bg-gray-100"
          >
            {t('auditLogs.clearFilters')}
          </button>
        )}
      </div>

      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><p className="font-cairo text-sm text-text-secondary">{t('auditLogs.error')}</p></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center font-cairo text-sm text-text-muted" data-testid="audit-empty">{t('auditLogs.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]" data-testid="audit-logs-table">
              <thead className="border-b border-border">
                <tr><Th>{t('auditLogs.colAction')}</Th><Th>{t('auditLogs.colEntity')}</Th><Th>{t('auditLogs.colActor')}</Th><Th>{t('auditLogs.colDate')}</Th><Th>{t('auditLogs.colView')}</Th></tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id} className="border-b border-border/60 hover:bg-gray-50" data-testid="audit-row">
                    <Td><Badge variant="cyan">{log.action}</Badge></Td>
                    <Td>{log.entityType}</Td>
                    <Td>{log.actor ? log.actor.fullName : (log.actorType ?? '—')}</Td>
                    <Td>{new Date(log.createdAt).toLocaleDateString(locale)}</Td>
                    <Td>
                      <button type="button" data-testid="audit-view-btn" onClick={() => setSelected(log)}
                        className="rounded-btn border border-border px-3 py-1 font-cairo text-xs text-accent hover:bg-gray-100">
                        {t('auditLogs.details')}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-btn border border-border px-3 py-1 font-cairo text-sm disabled:opacity-40">{t('auditLogs.prev')}</button>
            <span className="font-cairo text-sm text-text-secondary">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="rounded-btn border border-border px-3 py-1 font-cairo text-sm disabled:opacity-40">{t('auditLogs.next')}</button>
          </div>
        )}
      </div>

      {selected && <DetailDrawer log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
