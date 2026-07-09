import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, Search, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import {
  useAdminEntitlements,
  useAdminSubscriptionsList,
  useAdminPayments,
  useAdminSubscriptionRequests,
  useAdminAiUsage,
  useReviewSubscriptionRequest,
} from '@/features/admin/hooks/useAdminSubscriptions';
import type {
  AdminPaymentDTO,
  AdminSubscriptionListItem,
  AdminSubscriptionRequestItem,
  AiUsageRow,
  PaymentStatus,
  TeacherEntitlementRow,
} from '@/features/admin/types/subscriptions';

type TabKey = 'entitlements' | 'subscriptions' | 'payments' | 'requests' | 'ai-usage';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'entitlements', label: 'الاستحقاقات الحالية' },
  { key: 'subscriptions', label: 'الاشتراكات المدفوعة' },
  { key: 'payments', label: 'مدفوعات الاشتراكات' },
  { key: 'requests', label: 'طلبات الاشتراك اليدوية' },
  { key: 'ai-usage', label: 'استخدام الذكاء الاصطناعي' },
];

const LIMIT = 20;

function TeacherLink({ teacher }: { teacher: { id: string; fullName: string; email: string } }) {
  return (
    <Link
      to={`/admin/teachers/${teacher.id}`}
      data-testid="teacher-link"
      className="font-cairo text-sm font-semibold text-accent hover:underline"
    >
      {teacher.fullName}
    </Link>
  );
}

function PlanBadge({ code, displayName }: { code: string; displayName: string }) {
  const variant = code === 'FREE' ? 'default' : 'cyan';
  return <Badge variant={variant}>{displayName}</Badge>;
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const variant = status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'danger' : 'warning';
  return (
    <span data-testid={`payment-status-${status}`}>
      <Badge variant={variant}>{status}</Badge>
    </span>
  );
}

function StateWrap({
  isLoading,
  isError,
  isEmpty,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" />
        <p className="font-cairo text-sm text-text-secondary">تعذّر تحميل البيانات</p>
      </div>
    );
  }
  if (isEmpty) {
    return <p className="py-16 text-center font-cairo text-sm text-text-muted">لا توجد بيانات</p>;
  }
  return <>{children}</>;
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative max-w-xs">
      <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-3 text-text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="بحث بالاسم أو البريد"
        data-testid="subscriptions-search"
        className="h-10 w-full rounded-input border border-border bg-surface ps-3 pe-9 font-cairo text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-btn border border-border px-3 py-1 font-cairo text-sm disabled:opacity-40"
      >
        السابق
      </button>
      <span className="font-cairo text-sm text-text-secondary">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-btn border border-border px-3 py-1 font-cairo text-sm disabled:opacity-40"
      >
        التالي
      </button>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

// ── Tab: entitlements ────────────────────────────────────────────────────────
function EntitlementsTab({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminEntitlements({ q, page, limit: LIMIT });
  const rows = (data?.data ?? []) as TeacherEntitlementRow[];
  return (
    <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="entitlements-table">
          <thead className="border-b border-border">
            <tr>
              <Th>المدرس</Th><Th>الاستحقاق</Th><Th>الباقة</Th>
              <Th>مدفوعات ناجحة</Th><Th>مدفوعات فاشلة</Th><Th>الإيراد المؤكد</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teacher.id} className="border-b border-border/60">
                <Td><TeacherLink teacher={r.teacher} /></Td>
                <Td>
                  {r.entitlementSource === 'ACTIVE_SUBSCRIPTION' ? (
                    <span data-testid="entitlement-badge-paid"><Badge variant="success">مدفوع</Badge></span>
                  ) : (
                    <span data-testid="entitlement-badge-free"><Badge variant="default">مجاني</Badge></span>
                  )}
                </Td>
                <Td><PlanBadge code={r.currentPlan.code} displayName={r.currentPlan.displayName} /></Td>
                <Td>{r.successfulPaymentsCount}</Td>
                <Td>{r.failedPaymentsCount}</Td>
                <Td>{r.confirmedSubscriptionRevenue} ج.م</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </StateWrap>
  );
}

// ── Tab: subscriptions ───────────────────────────────────────────────────────
function SubscriptionsTab({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminSubscriptionsList({ q, page, limit: LIMIT });
  const rows = (data?.data ?? []) as AdminSubscriptionListItem[];
  return (
    <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="subscriptions-table">
          <thead className="border-b border-border">
            <tr><Th>المدرس</Th><Th>الباقة</Th><Th>الحالة</Th><Th>الفترة</Th><Th>نهاية الدورة</Th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/60">
                <Td><TeacherLink teacher={s.teacher} /></Td>
                <Td><PlanBadge code={s.plan.code} displayName={s.plan.displayName} /></Td>
                <Td><Badge variant={s.status === 'ACTIVE' ? 'success' : 'warning'}>{s.status}</Badge></Td>
                <Td>{s.billingInterval}</Td>
                <Td>{new Date(s.currentPeriodEnd).toLocaleDateString('ar-EG')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </StateWrap>
  );
}

// ── Tab: payments ────────────────────────────────────────────────────────────
function PaymentsTab({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminPayments({ q, page, limit: LIMIT });
  const rows = (data?.data ?? []) as AdminPaymentDTO[];
  return (
    <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="payments-table">
          <thead className="border-b border-border">
            <tr><Th>المدرس</Th><Th>الباقة</Th><Th>المبلغ</Th><Th>الحالة</Th><Th>المزود</Th><Th>التاريخ</Th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <Td><TeacherLink teacher={p.teacher} /></Td>
                <Td><PlanBadge code={p.plan.code} displayName={p.plan.displayName} /></Td>
                <Td>{p.amount} {p.currency}</Td>
                <Td><PaymentStatusBadge status={p.status} /></Td>
                <Td>{p.provider}</Td>
                <Td>{new Date(p.createdAt).toLocaleDateString('ar-EG')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </StateWrap>
  );
}

// ── Tab: manual requests ─────────────────────────────────────────────────────
function RequestsTab({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const dispatch = useAppDispatch();
  const { data, isLoading, isError } = useAdminSubscriptionRequests({ q, page, limit: LIMIT });
  const { approve, reject } = useReviewSubscriptionRequest();
  const rows = (data?.data ?? []) as AdminSubscriptionRequestItem[];

  const onApprove = (id: string) =>
    approve.mutate(
      { requestId: id },
      {
        onSuccess: () => dispatch(addToast({ type: 'success', message: 'تمت الموافقة على الطلب' })),
        onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: e.message ?? 'تعذّر تنفيذ الإجراء' })),
      },
    );
  const onReject = (id: string) => {
    const reason = window.prompt('سبب الرفض');
    if (!reason || !reason.trim()) return;
    reject.mutate(
      { requestId: id, adminNotes: reason.trim() },
      {
        onSuccess: () => dispatch(addToast({ type: 'success', message: 'تم رفض الطلب' })),
        onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: e.message ?? 'تعذّر تنفيذ الإجراء' })),
      },
    );
  };

  return (
    <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="requests-table">
          <thead className="border-b border-border">
            <tr><Th>المدرس</Th><Th>الباقة</Th><Th>الفترة</Th><Th>الحالة</Th><Th>إجراءات</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <Td><TeacherLink teacher={r.teacher} /></Td>
                <Td><PlanBadge code={r.plan.code} displayName={r.plan.displayName} /></Td>
                <Td>{r.requestedInterval}</Td>
                <Td>
                  <Badge variant={r.status === 'PENDING' ? 'warning' : r.status === 'APPROVED' ? 'success' : 'danger'}>
                    {r.status}
                  </Badge>
                </Td>
                <Td>
                  {r.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-testid="manual-approve-btn"
                        onClick={() => onApprove(r.id)}
                        disabled={approve.isPending}
                        className="inline-flex items-center gap-1 rounded-btn bg-success px-3 py-1 font-cairo text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <CheckCircle size={14} /> قبول
                      </button>
                      <button
                        type="button"
                        data-testid="manual-reject-btn"
                        onClick={() => onReject(r.id)}
                        disabled={reject.isPending}
                        className="inline-flex items-center gap-1 rounded-btn border border-danger px-3 py-1 font-cairo text-xs font-semibold text-danger disabled:opacity-50"
                      >
                        <XCircle size={14} /> رفض
                      </button>
                    </div>
                  ) : (
                    <span className="font-cairo text-xs text-text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </StateWrap>
  );
}

// ── Tab: AI usage ────────────────────────────────────────────────────────────
function AiUsageTab({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminAiUsage({ q, page, limit: LIMIT });
  const rows = (data?.data ?? []) as AiUsageRow[];
  return (
    <StateWrap isLoading={isLoading} isError={isError} isEmpty={rows.length === 0}>
      {data && (
        <div className="mb-4 flex flex-wrap gap-4 font-cairo text-sm">
          <span className="rounded-lg bg-surface px-3 py-1.5">
            إجمالي العمليات: <strong>{data.totals.totalEvents}</strong>
          </span>
          <span className="rounded-lg bg-surface px-3 py-1.5">
            إجمالي الوحدات: <strong>{data.totals.totalUnits}</strong>
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="ai-usage-table">
          <thead className="border-b border-border">
            <tr>
              <Th>المدرس</Th><Th>العمليات</Th><Th>الوحدات</Th><Th>هذا الشهر</Th>
              <Th>توليد اختبارات</Th><Th>تصحيح مقالات</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teacher.id} className="border-b border-border/60">
                <Td><TeacherLink teacher={r.teacher} /></Td>
                <Td>{r.totalEvents}</Td>
                <Td>{r.totalUnits}</Td>
                <Td>{r.currentMonthUnits}</Td>
                <Td>{r.byType.AI_QUIZ_GENERATION}</Td>
                <Td>{r.byType.AI_ESSAY_GRADING}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </StateWrap>
  );
}

export function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<TabKey>('entitlements');
  const [q, setQ] = useState('');

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir="rtl" data-testid="admin-subscriptions-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">الاشتراكات</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">
          مراجعة استحقاقات المدرسين والاشتراكات والمدفوعات والطلبات اليدوية واستخدام الذكاء الاصطناعي
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((tItem) => (
          <button
            key={tItem.key}
            type="button"
            role="tab"
            aria-selected={tab === tItem.key}
            data-testid={`tab-${tItem.key}`}
            onClick={() => setTab(tItem.key)}
            className={`-mb-px border-b-2 px-4 py-2 font-cairo text-sm font-medium transition-colors ${
              tab === tItem.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      <SearchBar value={q} onChange={setQ} />

      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        {tab === 'entitlements' && <EntitlementsTab q={q} />}
        {tab === 'subscriptions' && <SubscriptionsTab q={q} />}
        {tab === 'payments' && <PaymentsTab q={q} />}
        {tab === 'requests' && <RequestsTab q={q} />}
        {tab === 'ai-usage' && <AiUsageTab q={q} />}
      </div>
    </div>
  );
}
