import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { useCoursePayments, useSubscriptionPayments } from '@/features/admin/hooks/useAdminRevenue';
import type {
  CoursePaymentDTO,
  PaymentStatus,
  PaymentsQuery,
  SubscriptionPaymentDTO,
} from '@/features/admin/types/revenue';

type TabKey = 'course' | 'subscriptions';

function StatusBadge({ status }: { status: PaymentStatus }) {
  const variant = status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'danger' : 'warning';
  return (
    <span data-testid={`payment-status-${status}`}>
      <Badge variant={variant}>{status}</Badge>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

type DrawerRow =
  | { kind: 'course'; row: CoursePaymentDTO }
  | { kind: 'subscription'; row: SubscriptionPaymentDTO };

function PaymentDrawer({ entry, onClose }: { entry: DrawerRow; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const { row } = entry;
  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/40" onClick={onClose} data-testid="payment-drawer">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-cairo text-lg font-bold text-navy-900">{t('adminPayments.drawerTitle')}</h3>
          <button type="button" onClick={onClose} className="rounded-btn p-1.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <dl className="flex flex-col gap-3 font-cairo text-sm">
          <Row label={t('adminPayments.drawerStatus')}><StatusBadge status={row.status} /></Row>
          <Row label={t('adminPayments.drawerAmount')}>{row.amount.toLocaleString(locale)} {row.currency}</Row>
          {entry.kind === 'course' ? (
            <>
              <Row label={t('adminPayments.drawerStudent')}>{entry.row.student.fullName}</Row>
              <Row label={t('adminPayments.drawerChapter')}>{entry.row.chapter.name}</Row>
              <Row label={t('adminPayments.drawerTeacher')}>{entry.row.teacher?.fullName ?? '—'}</Row>
            </>
          ) : (
            <>
              <Row label={t('adminPayments.drawerTeacher')}>{entry.row.teacher.fullName}</Row>
              <Row label={t('adminPayments.drawerPlan')}>{entry.row.plan.displayName}</Row>
              <Row label={t('adminPayments.drawerProvider')}>{entry.row.provider}</Row>
              <Row label={t('adminPayments.drawerInterval')}>{entry.row.billingInterval}</Row>
            </>
          )}
          <Row label={t('adminPayments.drawerCreatedAt')}>{new Date(row.createdAt).toLocaleString(locale)}</Row>
          <Row label={t('adminPayments.drawerPaidAt')}>{row.paidAt ? new Date(row.paidAt).toLocaleString(locale) : '—'}</Row>
        </dl>
      </div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{children}</dd>
    </div>
  );
}

function Filters({ query, onChange }: { query: PaymentsQuery; onChange: (q: PaymentsQuery) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="payment-filters">
      <input
        value={query.q ?? ''}
        onChange={(e) => onChange({ ...query, q: e.target.value || undefined, page: 1 })}
        placeholder={t('adminPayments.filterSearch')}
        data-testid="filter-search"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      />
      <select
        value={query.status ?? ''}
        onChange={(e) => onChange({ ...query, status: (e.target.value || undefined) as PaymentStatus | undefined, page: 1 })}
        data-testid="filter-status"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      >
        <option value="">{t('adminPayments.filterAllStatuses')}</option>
        <option value="SUCCESS">{t('adminPayments.filterSuccess')}</option>
        <option value="PENDING">{t('adminPayments.filterPending')}</option>
        <option value="FAILED">{t('adminPayments.filterFailed')}</option>
      </select>
      <input
        type="date"
        value={query.dateFrom ?? ''}
        onChange={(e) => onChange({ ...query, dateFrom: e.target.value || undefined, page: 1 })}
        data-testid="filter-date-from"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      />
      <input
        type="date"
        value={query.dateTo ?? ''}
        onChange={(e) => onChange({ ...query, dateTo: e.target.value || undefined, page: 1 })}
        data-testid="filter-date-to"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

function StateWrap({ isLoading, isError, isEmpty, children }: { isLoading: boolean; isError: boolean; isEmpty: boolean; children: React.ReactNode }) {
  const { t } = useTranslation();
  if (isLoading) return <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  if (isError) return <div className="flex flex-col items-center gap-2 py-16 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><p className="font-cairo text-sm text-text-secondary">{t('adminPayments.errorLoading')}</p></div>;
  if (isEmpty) return <p className="py-16 text-center font-cairo text-sm text-text-muted">{t('adminPayments.empty')}</p>;
  return <>{children}</>;
}

function CourseTab({ onOpen }: { onOpen: (e: DrawerRow) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const [query, setQuery] = useState<PaymentsQuery>({ page: 1, limit: 20 });
  const { data, isLoading, isError } = useCoursePayments(query);
  const rows = (data?.data ?? []) as CoursePaymentDTO[];
  return (
    <div className="flex flex-col gap-4">
      <Filters query={query} onChange={setQuery} />
      <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="course-payments-table">
            <thead className="border-b border-border">
              <tr><Th>{t('adminPayments.colStudent')}</Th><Th>{t('adminPayments.colChapter')}</Th><Th>{t('adminPayments.colTeacher')}</Th><Th>{t('adminPayments.colAmount')}</Th><Th>{t('adminPayments.colStatus')}</Th><Th>{t('adminPayments.colDate')}</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-border/60 hover:bg-gray-50" data-testid="course-payment-row" onClick={() => onOpen({ kind: 'course', row: p })}>
                  <Td>{p.student.fullName}</Td>
                  <Td>{p.chapter.name}</Td>
                  <Td>{p.teacher ? (
                    <Link to={`/admin/teachers/${p.teacher.id}`} data-testid="teacher-link" className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{p.teacher.fullName}</Link>
                  ) : '—'}</Td>
                  <Td>{p.amount.toLocaleString(locale)} {p.currency}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{new Date(p.createdAt).toLocaleDateString(locale)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateWrap>
    </div>
  );
}

function SubscriptionTab({ onOpen }: { onOpen: (e: DrawerRow) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const [query, setQuery] = useState<PaymentsQuery>({ page: 1, limit: 20 });
  const { data, isLoading, isError } = useSubscriptionPayments(query);
  const rows = (data?.data ?? []) as SubscriptionPaymentDTO[];
  return (
    <div className="flex flex-col gap-4">
      <Filters query={query} onChange={setQuery} />
      <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="subscription-payments-table">
            <thead className="border-b border-border">
              <tr><Th>{t('adminPayments.colTeacher')}</Th><Th>{t('adminPayments.colPlan')}</Th><Th>{t('adminPayments.colAmount')}</Th><Th>{t('adminPayments.colStatus')}</Th><Th>{t('adminPayments.colProvider')}</Th><Th>{t('adminPayments.colDate')}</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-border/60 hover:bg-gray-50" data-testid="subscription-payment-row" onClick={() => onOpen({ kind: 'subscription', row: p })}>
                  <Td>
                    <Link to={`/admin/teachers/${p.teacher.id}`} data-testid="teacher-link" className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{p.teacher.fullName}</Link>
                  </Td>
                  <Td>{p.plan.displayName}</Td>
                  <Td>{p.amount.toLocaleString(locale)} {p.currency}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{p.provider}</Td>
                  <Td>{new Date(p.createdAt).toLocaleDateString(locale)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateWrap>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('course');
  const [drawer, setDrawer] = useState<DrawerRow | null>(null);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'course', label: t('adminPayments.tabCourse') },
    { key: 'subscriptions', label: t('adminPayments.tabSubscriptions') },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" data-testid="admin-payments-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('adminPayments.title')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminPayments.subtitle')}</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tItem) => (
          <button
            key={tItem.key}
            type="button"
            role="tab"
            aria-selected={tab === tItem.key}
            data-testid={`tab-${tItem.key}`}
            onClick={() => setTab(tItem.key)}
            className={`-mb-px border-b-2 px-4 py-2 font-cairo text-sm font-medium transition-colors ${
              tab === tItem.key ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        {tab === 'course' ? <CourseTab onOpen={setDrawer} /> : <SubscriptionTab onOpen={setDrawer} />}
      </div>

      {drawer && <PaymentDrawer entry={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}
