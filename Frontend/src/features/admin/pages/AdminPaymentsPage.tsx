import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { row } = entry;
  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/40" onClick={onClose} data-testid="payment-drawer">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-cairo text-lg font-bold text-navy-900">تفاصيل الدفعة</h3>
          <button type="button" onClick={onClose} className="rounded-btn p-1.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <dl className="flex flex-col gap-3 font-cairo text-sm">
          <Row label="الحالة"><StatusBadge status={row.status} /></Row>
          <Row label="المبلغ">{row.amount.toLocaleString('ar-EG')} {row.currency}</Row>
          {entry.kind === 'course' ? (
            <>
              <Row label="الطالب">{entry.row.student.fullName}</Row>
              <Row label="الفصل">{entry.row.chapter.name}</Row>
              <Row label="المدرس">{entry.row.teacher?.fullName ?? '—'}</Row>
            </>
          ) : (
            <>
              <Row label="المدرس">{entry.row.teacher.fullName}</Row>
              <Row label="الباقة">{entry.row.plan.displayName}</Row>
              <Row label="المزود">{entry.row.provider}</Row>
              <Row label="الفترة">{entry.row.billingInterval}</Row>
            </>
          )}
          <Row label="تاريخ الإنشاء">{new Date(row.createdAt).toLocaleString('ar-EG')}</Row>
          <Row label="تاريخ الدفع">{row.paidAt ? new Date(row.paidAt).toLocaleString('ar-EG') : '—'}</Row>
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
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="payment-filters">
      <input
        value={query.q ?? ''}
        onChange={(e) => onChange({ ...query, q: e.target.value || undefined, page: 1 })}
        placeholder="بحث بالاسم أو البريد"
        data-testid="filter-search"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      />
      <select
        value={query.status ?? ''}
        onChange={(e) => onChange({ ...query, status: (e.target.value || undefined) as PaymentStatus | undefined, page: 1 })}
        data-testid="filter-status"
        className="h-10 rounded-input border border-border bg-surface px-3 font-cairo text-sm outline-none focus:border-accent"
      >
        <option value="">كل الحالات</option>
        <option value="SUCCESS">ناجحة</option>
        <option value="PENDING">معلقة</option>
        <option value="FAILED">فاشلة</option>
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
  if (isLoading) return <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  if (isError) return <div className="flex flex-col items-center gap-2 py-16 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><p className="font-cairo text-sm text-text-secondary">تعذّر تحميل المدفوعات</p></div>;
  if (isEmpty) return <p className="py-16 text-center font-cairo text-sm text-text-muted">لا توجد مدفوعات</p>;
  return <>{children}</>;
}

function CourseTab({ onOpen }: { onOpen: (e: DrawerRow) => void }) {
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
              <tr><Th>الطالب</Th><Th>الفصل</Th><Th>المدرس</Th><Th>المبلغ</Th><Th>الحالة</Th><Th>التاريخ</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-border/60 hover:bg-gray-50" data-testid="course-payment-row" onClick={() => onOpen({ kind: 'course', row: p })}>
                  <Td>{p.student.fullName}</Td>
                  <Td>{p.chapter.name}</Td>
                  <Td>{p.teacher ? (
                    <Link to={`/admin/teachers/${p.teacher.id}`} data-testid="teacher-link" className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{p.teacher.fullName}</Link>
                  ) : '—'}</Td>
                  <Td>{p.amount.toLocaleString('ar-EG')} {p.currency}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{new Date(p.createdAt).toLocaleDateString('ar-EG')}</Td>
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
              <tr><Th>المدرس</Th><Th>الباقة</Th><Th>المبلغ</Th><Th>الحالة</Th><Th>المزود</Th><Th>التاريخ</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-border/60 hover:bg-gray-50" data-testid="subscription-payment-row" onClick={() => onOpen({ kind: 'subscription', row: p })}>
                  <Td>
                    <Link to={`/admin/teachers/${p.teacher.id}`} data-testid="teacher-link" className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{p.teacher.fullName}</Link>
                  </Td>
                  <Td>{p.plan.displayName}</Td>
                  <Td>{p.amount.toLocaleString('ar-EG')} {p.currency}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{p.provider}</Td>
                  <Td>{new Date(p.createdAt).toLocaleDateString('ar-EG')}</Td>
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
  const [tab, setTab] = useState<TabKey>('course');
  const [drawer, setDrawer] = useState<DrawerRow | null>(null);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'course', label: 'مدفوعات الكورسات' },
    { key: 'subscriptions', label: 'مدفوعات الاشتراكات' },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir="rtl" data-testid="admin-payments-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">المدفوعات</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">مدفوعات الكورسات واشتراكات المدرسين (بيانات آمنة فقط)</p>
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
