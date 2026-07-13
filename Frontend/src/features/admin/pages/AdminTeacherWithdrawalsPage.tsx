import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, AlertCircle, Banknote, Eye, Wallet, ArrowDownToLine, Clock, CreditCard } from 'lucide-react';
import { Spinner, Badge, EmptyState, Modal, Button } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { Pagination } from '../components/promo-codes';
import {
  useAdminTeacherWithdrawals,
  useUpdateWithdrawalStatus,
  useTeacherFinancialSummary,
} from '@/features/admin/hooks/useAdminTeacherWithdrawals';
import type {
  AdminWithdrawalListItem,
  TeacherFinancialSummary,
  UpdatableWithdrawalStatus,
  WithdrawalStatus,
} from '@/features/admin/types/teacherWithdrawals';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: (WithdrawalStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'PROCESSING',
  'TRANSFERRED',
  'REJECTED',
  'CANCELLED',
];

export const withdrawalStatusVariant: Record<
  WithdrawalStatus,
  'warning' | 'info' | 'success' | 'danger' | 'default'
> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  TRANSFERRED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

/** Only the transitions the CURRENT status legally allows — never a step-back. */
const NEXT_STATUS_OPTIONS: Record<WithdrawalStatus, UpdatableWithdrawalStatus[]> = {
  PENDING: ['PROCESSING', 'TRANSFERRED', 'REJECTED'],
  PROCESSING: ['TRANSFERRED', 'REJECTED'],
  TRANSFERRED: [],
  REJECTED: [],
  CANCELLED: [],
};

function DetailDrawer({
  withdrawal,
  onClose,
}: {
  withdrawal: AdminWithdrawalListItem;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const updateStatus = useUpdateWithdrawalStatus();
  const [adminNote, setAdminNote] = useState(withdrawal.adminNote ?? '');
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : '—');

  const handleUpdate = (status: UpdatableWithdrawalStatus) => {
    updateStatus.mutate(
      { withdrawalId: withdrawal.id, body: { status, ...(adminNote.trim() ? { adminNote: adminNote.trim() } : {}) } },
      {
        onSuccess: () => {
          dispatch(addToast({ type: 'success', message: t('adminTeacherWithdrawals.detail.updated', 'تم تحديث حالة الطلب') }));
          onClose();
        },
        onError: (error) => {
          dispatch(
            addToast({
              type: 'error',
              message: translateApiError(t, error),
            }),
          );
        },
      },
    );
  };

  const nextOptions = NEXT_STATUS_OPTIONS[withdrawal.status];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('adminTeacherWithdrawals.detail.title', 'تفاصيل طلب السحب')}
      size="lg"
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('adminTeacherWithdrawals.col.teacher', 'المدرس')} value={`${withdrawal.teacher.fullName} · ${withdrawal.teacher.email}`} />
          <Field label={t('adminTeacherWithdrawals.col.amount', 'المبلغ')} value={`${Math.round(withdrawal.amount).toLocaleString(locale)} ${withdrawal.currency}`} />
          <Field label={t('adminTeacherWithdrawals.col.requestedAt', 'تاريخ الطلب')} value={fmt(withdrawal.requestedAt)} />
          <Field label={t('adminTeacherWithdrawals.detail.processedAt', 'تاريخ المعالجة')} value={fmt(withdrawal.processedAt)} />
          <Field label={t('adminTeacherWithdrawals.detail.transferredAt', 'تاريخ التحويل')} value={fmt(withdrawal.transferredAt)} />
          <Field label={t('adminTeacherWithdrawals.detail.cancelledAt', 'تاريخ الإلغاء/الرفض')} value={fmt(withdrawal.cancelledAt)} />
        </div>

        <div className="rounded-card border border-border p-3">
          <p className="mb-2 font-cairo text-xs font-semibold text-text-secondary">
            {t('adminTeacherWithdrawals.detail.payoutMethod', 'بيانات استلام الأرباح')}
          </p>
          <p className="font-cairo text-sm text-text-primary" data-testid="detail-payout-snapshot">
            InstaPay: {withdrawal.payoutMethodSnapshot?.instaPayHandle ?? '—'} · Vodafone Cash:{' '}
            {withdrawal.payoutMethodSnapshot?.vodafoneCashNumber ?? '—'}
          </p>
        </div>

        {withdrawal.teacherNote && (
          <Field label={t('adminTeacherWithdrawals.detail.teacherNote', 'ملاحظة المدرس')} value={withdrawal.teacherNote} />
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-note" className="font-cairo text-sm font-medium text-text-primary">
            {t('adminTeacherWithdrawals.detail.adminNote', 'ملاحظة الإدارة')}
          </label>
          <textarea
            id="admin-note"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="min-h-20 w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Badge variant={withdrawalStatusVariant[withdrawal.status]}>
            {t(`adminTeacherWithdrawals.status.${withdrawal.status}`, withdrawal.status)}
          </Badge>

          {nextOptions.length === 0 ? (
            <p className="font-cairo text-xs text-text-muted" data-testid="detail-readonly">
              {t('adminTeacherWithdrawals.detail.readOnly', 'حالة نهائية — لا توجد إجراءات متاحة')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nextOptions.includes('PROCESSING') && (
                <Button
                  variant="secondary"
                  disabled={updateStatus.isPending}
                  onClick={() => handleUpdate('PROCESSING')}
                  data-testid="action-processing"
                >
                  {t('adminTeacherWithdrawals.action.processing', 'مقبول / جاري التحويل')}
                </Button>
              )}
              {nextOptions.includes('TRANSFERRED') && (
                <Button
                  disabled={updateStatus.isPending}
                  onClick={() => handleUpdate('TRANSFERRED')}
                  data-testid="action-transferred"
                >
                  {t('adminTeacherWithdrawals.action.transferred', 'تم التحويل')}
                </Button>
              )}
              {nextOptions.includes('REJECTED') && (
                <Button
                  variant="danger"
                  disabled={updateStatus.isPending}
                  onClick={() => handleUpdate('REJECTED')}
                  data-testid="action-rejected"
                >
                  {t('adminTeacherWithdrawals.action.rejected', 'رفض')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-cairo text-xs text-text-secondary">{label}</span>
      <span className="font-cairo text-sm text-text-primary">{value}</span>
    </div>
  );
}

function MoneyCard({
  testid,
  icon: Icon,
  label,
  value,
  currency,
  locale,
}: {
  testid: string;
  icon: typeof Wallet;
  label: string;
  value: number;
  currency: string;
  locale: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card"
      data-testid={testid}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">
          {value.toLocaleString(locale)}{' '}
          <span className="text-xs font-normal text-text-muted">{currency}</span>
        </p>
      </div>
    </div>
  );
}

function SummaryCards({
  summaries,
  locale,
  t,
}: {
  summaries: TeacherFinancialSummary[];
  locale: string;
  t: (key: string, fallback?: string) => string;
}) {
  if (summaries.length === 0) return null;

  // Aggregate totals across all teachers
  const total = summaries.reduce(
    (acc, s) => ({
      earnings: acc.earnings + s.totalEarnings,
      withdrawn: acc.withdrawn + s.totalWithdrawn,
      pending: acc.pending + s.pendingWithdrawalAmount,
      balance: acc.balance + s.remainingAvailableBalance,
      subPaid: acc.subPaid + s.teacherSubscriptionTotalPaid,
    }),
    { earnings: 0, withdrawn: 0, pending: 0, balance: 0, subPaid: 0 },
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="teacher-summary-cards">
      <MoneyCard
        testid="summary-total-earnings"
        icon={Wallet}
        label={t('adminTeacherWithdrawals.summary.totalEarnings', 'إجمالي الأرباح')}
        value={total.earnings}
        currency="EGP"
        locale={locale}
      />
      <MoneyCard
        testid="summary-total-withdrawn"
        icon={ArrowDownToLine}
        label={t('adminTeacherWithdrawals.summary.totalWithdrawn', 'تم سحبه')}
        value={total.withdrawn}
        currency="EGP"
        locale={locale}
      />
      <MoneyCard
        testid="summary-pending"
        icon={Clock}
        label={t('adminTeacherWithdrawals.summary.pendingWithdrawals', 'معلق')}
        value={total.pending}
        currency="EGP"
        locale={locale}
      />
      <MoneyCard
        testid="summary-available-balance"
        icon={Banknote}
        label={t('adminTeacherWithdrawals.summary.availableBalance', 'المتاح للسحب')}
        value={total.balance}
        currency="EGP"
        locale={locale}
      />
      <MoneyCard
        testid="summary-subscription-paid"
        icon={CreditCard}
        label={t('adminTeacherWithdrawals.summary.subscriptionPaid', 'اشتراكات المدرس')}
        value={total.subPaid}
        currency="EGP"
        locale={locale}
      />
    </div>
  );
}

export function AdminTeacherWithdrawalsPage() {
  const { t, i18n } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(
    () => ({ page, limit: PAGE_SIZE, ...(q ? { q } : {}), ...(status !== 'ALL' ? { status } : {}) }),
    [page, q, status],
  );
  const { data, isLoading, isError, refetch, isFetching } = useAdminTeacherWithdrawals(query);

  // Teacher financial summary (no filters — shows all teachers)
  const { data: summaries, isLoading: summariesLoading } = useTeacherFinancialSummary();

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && rows.length === 0;
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" data-testid="admin-teacher-withdrawals-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-text-primary">
          {t('adminTeacherWithdrawals.title', 'طلبات سحب الأرباح')}
        </h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">
          {t('adminTeacherWithdrawals.subtitle', 'مراجعة ومعالجة طلبات سحب أرباح المدرسين')}
        </p>
      </div>

      {summariesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <SummaryCards summaries={summaries ?? []} locale={locale} t={t as (key: string, fallback?: string) => string} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminTeacherWithdrawals.searchPlaceholder', 'ابحث باسم المدرس أو بريده')}
            aria-label={t('adminTeacherWithdrawals.searchPlaceholder', 'ابحث باسم المدرس أو بريده')}
            data-testid="withdrawals-search"
            className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('adminTeacherWithdrawals.statusFilter', 'تصفية الحالة')} data-testid="status-filters">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setStatus(opt);
                setPage(1);
              }}
              data-testid={`status-filter-${opt}`}
              className={`rounded-btn border px-3 py-1.5 font-cairo text-sm font-medium transition-colors ${
                status === opt
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text-secondary hover:bg-gray-100'
              }`}
            >
              {t(`adminTeacherWithdrawals.status.${opt}`, opt)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">
            {t('adminTeacherWithdrawals.errorLoading', 'تعذّر تحميل طلبات السحب')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100"
          >
            {t('adminTeacherWithdrawals.retry', 'إعادة المحاولة')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
              <Spinner />
            </div>
          ) : isEmpty ? (
            <div className="py-12">
              <EmptyState
                icon={Banknote}
                title={t('adminTeacherWithdrawals.emptyTitle', 'لا توجد طلبات سحب')}
                description={t('adminTeacherWithdrawals.emptyDescription', 'لا توجد طلبات مطابقة')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[820px] text-start text-sm" data-testid="withdrawals-admin-table">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherWithdrawals.col.teacher', 'المدرس')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherWithdrawals.col.amount', 'المبلغ')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherWithdrawals.col.status', 'الحالة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherWithdrawals.col.requestedAt', 'تاريخ الطلب')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-gray-50" data-testid={`withdrawal-admin-row-${r.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-cairo font-semibold text-text-primary">{r.teacher.fullName}</span>
                          <span className="font-cairo text-xs text-text-secondary">{r.teacher.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-cairo text-text-primary">
                        {Math.round(r.amount).toLocaleString(locale)} {r.currency}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={withdrawalStatusVariant[r.status]}>
                          {t(`adminTeacherWithdrawals.status.${r.status}`, r.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-cairo text-text-secondary">{fmtDate(r.requestedAt)}</td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          data-testid={`view-withdrawal-${r.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
                        >
                          <Eye size={14} />
                          {t('adminTeacherWithdrawals.view', 'عرض')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={isFetching} />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="font-cairo text-xs text-text-muted">
          {t('adminTeacherWithdrawals.totalCount', '{{count}} طلب', { count: total })}
        </p>
      )}

      {selected && <DetailDrawer withdrawal={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
