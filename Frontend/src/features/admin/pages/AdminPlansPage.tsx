import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, CreditCard, DollarSign, Users, AlertCircle, ChevronLeft,
  CheckCircle2, XCircle, Star,
} from 'lucide-react';
import { Spinner, Badge, EmptyState } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import { useAdminPlans } from '@/features/admin/hooks/useAdminPlans';

const PAGE_SIZE = 20;
const FILTER_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

export function AdminPlansPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ${t('adminPlans.currency', 'ج.م')}`;

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(q ? { q } : {}),
      ...(filter !== 'ALL' ? { isActive: filter === 'ACTIVE' ? 'true' : 'false' } : {}),
    }),
    [page, q, filter],
  );

  const { data, isLoading, isError, refetch, isFetching } = useAdminPlans(query);

  const plans = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && plans.length === 0;

  const header = (
    <div>
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('adminPlans.title', 'الباقات')}
      </h1>
      <p className="mt-1 font-cairo text-sm text-text-secondary">
        {t('adminPlans.subtitle', 'إدارة باقات المدرسين وإحصاءاتها')}
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      {header}

      {/* Controls: search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminPlans.searchPlaceholder', 'ابحث باسم الباقة أو الكود')}
            aria-label={t('adminPlans.searchPlaceholder', 'ابحث باسم الباقة أو الكود')}
            className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={t('adminPlans.filterLabel', 'تصفية الحالة')}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setFilter(opt); setPage(1); }}
              className={`rounded-btn border px-3 py-1.5 font-cairo text-sm font-medium transition-colors ${
                filter === opt
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text-secondary hover:bg-gray-100'
              }`}
            >
              {t(`adminPlans.filter.${opt}`, opt)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">
            {t('adminPlans.errorLoading', 'تعذّر تحميل قائمة الباقات')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
          >
            {t('adminPlans.retry', 'إعادة المحاولة')}
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
                icon={CreditCard}
                title={t('adminPlans.emptyTitle', 'لا توجد باقات')}
                description={t('adminPlans.emptyDescription', 'لم يتم العثور على باقات مطابقة لبحثك')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[900px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.plan', 'الباقة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.monthlyPrice', 'السعر الشهري')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.yearlyPrice', 'السعر السنوي')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.activeSubscriptions', 'الاشتراكات النشطة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.pendingPayments', 'مدفوعات معلقة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminPlans.col.confirmedRevenue', 'الإيرادات المؤكدة')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <PlanRow key={plan.id} plan={plan} money={money} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isFetching}
            />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="font-cairo text-xs text-text-muted">
          {t('adminPlans.totalCount', '{{count}} باقة', { count: total })}
        </p>
      )}
    </div>
  );
}

function PlanRow({
  plan,
  money,
}: {
  plan: { id: string; code: string; displayName: string; monthlyPrice: number; yearlyPrice: number | null; isActive: boolean; isRecommended: boolean; currency: string; stats: { activePaidSubscriptionsCount: number; pendingPaymentsCount: number; confirmedRevenue: number } };
  money: (n: number) => string;
}) {
  const { t } = useTranslation();
  const isFree = plan.monthlyPrice === 0;
  const isPaid = !isFree;

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-gray-50">
      {/* Plan identity */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-cairo font-semibold text-text-primary">{plan.displayName}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {isFree && (
              <Badge variant="success">
                <CheckCircle2 size={11} className="me-1" />
                {t('adminPlans.badges.free', 'مجاني')}
              </Badge>
            )}
            {isPaid && (
              <Badge variant="cyan">
                <DollarSign size={11} className="me-1" />
                {t('adminPlans.badges.paid', 'مدفوع')}
              </Badge>
            )}
            {plan.isActive ? (
              <Badge variant="success">
                <CheckCircle2 size={11} className="me-1" />
                {t('adminPlans.badges.active', 'نشط')}
              </Badge>
            ) : (
              <Badge variant="warning">
                <XCircle size={11} className="me-1" />
                {t('adminPlans.badges.inactive', 'غير نشط')}
              </Badge>
            )}
            {plan.isRecommended && (
              <Badge variant="info">
                <Star size={11} className="me-1" />
                {t('adminPlans.badges.recommended', 'موصى به')}
              </Badge>
            )}
          </div>
        </div>
      </td>

      {/* Monthly price */}
      <td className="px-4 py-3">
        <span className="font-cairo font-medium text-text-primary">
          {isFree ? '—' : money(plan.monthlyPrice)}
        </span>
      </td>

      {/* Yearly price */}
      <td className="px-4 py-3">
        <span className="font-cairo text-text-primary">
          {plan.yearlyPrice != null ? money(plan.yearlyPrice) : '—'}
        </span>
      </td>

      {/* Active subscriptions */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo text-text-primary">
          <Users size={14} className="text-text-muted" />
          {plan.stats.activePaidSubscriptionsCount.toLocaleString()}
        </span>
      </td>

      {/* Pending payments */}
      <td className="px-4 py-3">
        <span className="font-cairo text-text-primary">
          {plan.stats.pendingPaymentsCount.toLocaleString()}
        </span>
      </td>

      {/* Confirmed revenue */}
      <td className="px-4 py-3">
        <span className="font-cairo font-medium text-text-primary">
          {money(plan.stats.confirmedRevenue)}
        </span>
      </td>

      {/* View details */}
      <td className="px-4 py-3 text-end">
        <Link
          to={`/admin/plans/${plan.id}`}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
        >
          {t('adminPlans.viewDetails', 'عرض التفاصيل')}
          <ChevronLeft size={14} className="rtl:rotate-180" />
        </Link>
      </td>
    </tr>
  );
}
