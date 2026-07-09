import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, CreditCard, DollarSign, Users, AlertCircle, ChevronLeft,
  CheckCircle2, XCircle, Star, Plus, Pencil, Power, PowerOff,
  GripVertical, ArrowUp, ArrowDown, Save, X,
} from 'lucide-react';
import { Spinner, Badge, EmptyState, Button, ConfirmDialog } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import { useAdminPlans, useChangePlanStatus, useChangeRecommended, useReorderPlans } from '@/features/admin/hooks/useAdminPlans';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { CreatePlanModal } from '../components/plans/CreatePlanModal';
import { EditPlanModal } from '../components/plans/EditPlanModal';
import type { AdminPlanListItem } from '@/features/admin/types/plans';

const PAGE_SIZE = 20;
const FILTER_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

export function AdminPlansPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ${t('adminPlans.currency', 'ج.م')}`;

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const [page, setPage] = useState(1);

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminPlanListItem | null>(null);

  // Confirm dialog states
  const [statusTarget, setStatusTarget] = useState<AdminPlanListItem | null>(null);
  const [recommendedTarget, setRecommendedTarget] = useState<AdminPlanListItem | null>(null);

  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderItems, setReorderItems] = useState<AdminPlanListItem[]>([]);

  // Mutations
  const changeStatusMutation = useChangePlanStatus();
  const changeRecommendedMutation = useChangeRecommended();
  const reorderMutation = useReorderPlans();

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

  // ── Handlers ──

  const handleStatusToggle = async () => {
    if (!statusTarget) return;
    try {
      await changeStatusMutation.mutateAsync({
        planId: statusTarget.id,
        input: { isActive: !statusTarget.isActive },
      });
      dispatch(addToast({ type: 'success', message: t('adminPlansMutations.statusConfirm.success') }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch(addToast({ type: 'error', message: `${t('adminPlansMutations.statusConfirm.error')}: ${msg}` }));
    }
    setStatusTarget(null);
  };

  const handleRecommendedToggle = async () => {
    if (!recommendedTarget) return;
    try {
      await changeRecommendedMutation.mutateAsync({
        planId: recommendedTarget.id,
        input: { isRecommended: !recommendedTarget.isRecommended },
      });
      dispatch(addToast({ type: 'success', message: t('adminPlansMutations.recommendedConfirm.success') }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch(addToast({ type: 'error', message: `${t('adminPlansMutations.recommendedConfirm.error')}: ${msg}` }));
    }
    setRecommendedTarget(null);
  };

  const enterReorderMode = () => {
    setReorderItems([...plans].sort((a, b) => a.sortOrder - b.sortOrder));
    setReorderMode(true);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newList = [...reorderItems];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setReorderItems(newList);
  };

  const saveReorder = async () => {
    const items = reorderItems.map((plan, idx) => ({ id: plan.id, sortOrder: idx }));
    try {
      await reorderMutation.mutateAsync({ items });
      dispatch(addToast({ type: 'success', message: t('adminPlansMutations.reorderConfirm.success') }));
      setReorderMode(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch(addToast({ type: 'error', message: `${t('adminPlansMutations.reorderConfirm.error')}: ${msg}` }));
    }
  };

  const cancelReorder = () => {
    setReorderMode(false);
    setReorderItems([]);
  };

  // ── Render ──

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-text-primary">
            {t('adminPlans.title', 'الباقات')}
          </h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">
            {t('adminPlans.subtitle', 'إدارة باقات المدرسين وإحصاءاتها')}
          </p>
        </div>
        <div className="flex gap-2">
          {!reorderMode && (
            <>
              <Button variant="outline" size="sm" onClick={enterReorderMode}>
                <GripVertical size={16} />
                {t('adminPlansMutations.reorder')}
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
                {t('adminPlansMutations.addPlan')}
              </Button>
            </>
          )}
        </div>
      </div>

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

      {/* Reorder toolbar */}
      {reorderMode && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card">
          <span className="font-cairo text-sm font-medium text-text-primary">
            {t('adminPlansMutations.reorderTitle')}
          </span>
          <div className="mr-auto flex gap-2">
            <Button size="sm" onClick={saveReorder} loading={reorderMutation.isPending}>
              <Save size={16} />
              {t('adminPlansMutations.reorderSave')}
            </Button>
            <Button variant="outline" size="sm" onClick={cancelReorder}>
              <X size={16} />
              {t('adminPlansMutations.reorderCancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
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
              <table className="w-full min-w-[1100px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    {reorderMode && <th className="w-10 px-2 py-3"></th>}
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
                  {(reorderMode ? reorderItems : plans).map((plan, index) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      money={money}
                      reorderMode={reorderMode}
                      reorderIndex={index}
                      reorderTotal={reorderItems.length}
                      onMove={moveItem}
                      onEdit={setEditTarget}
                      onStatusToggle={setStatusTarget}
                      onRecommendedToggle={setRecommendedTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isEmpty && !isLoading && !reorderMode && totalPages > 1 && (
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

      {/* Modals */}
      <CreatePlanModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditPlanModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} plan={editTarget} />

      <ConfirmDialog
        isOpen={!!statusTarget}
        onConfirm={handleStatusToggle}
        onCancel={() => setStatusTarget(null)}
        title={statusTarget?.isActive
          ? t('adminPlansMutations.statusConfirm.deactivateTitle')
          : t('adminPlansMutations.statusConfirm.activateTitle')
        }
        message={statusTarget?.isActive
          ? t('adminPlansMutations.statusConfirm.deactivateMessage')
          : t('adminPlansMutations.statusConfirm.activateMessage')
        }
        variant={statusTarget?.isActive ? 'danger' : 'primary'}
      />

      <ConfirmDialog
        isOpen={!!recommendedTarget}
        onConfirm={handleRecommendedToggle}
        onCancel={() => setRecommendedTarget(null)}
        title={t('adminPlansMutations.recommendedConfirm.title')}
        message={t('adminPlansMutations.recommendedConfirm.message')}
        variant="primary"
      />
    </div>
  );
}

interface PlanRowProps {
  plan: AdminPlanListItem;
  money: (n: number) => string;
  reorderMode: boolean;
  reorderIndex: number;
  reorderTotal: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onEdit: (plan: AdminPlanListItem) => void;
  onStatusToggle: (plan: AdminPlanListItem) => void;
  onRecommendedToggle: (plan: AdminPlanListItem) => void;
}

function PlanRow({
  plan,
  money,
  reorderMode,
  reorderIndex,
  reorderTotal,
  onMove,
  onEdit,
  onStatusToggle,
  onRecommendedToggle,
}: PlanRowProps) {
  const { t } = useTranslation();
  const isFree = plan.monthlyPrice === 0;

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-gray-50">
      {/* Reorder controls */}
      {reorderMode && (
        <td className="px-2 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              disabled={reorderIndex === 0}
              onClick={() => onMove(reorderIndex, -1)}
              className="text-text-muted hover:text-text-primary disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp size={14} />
            </button>
            <GripVertical size={18} className="text-text-muted" />
            <button
              type="button"
              disabled={reorderIndex === reorderTotal - 1}
              onClick={() => onMove(reorderIndex, 1)}
              className="text-text-muted hover:text-text-primary disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        </td>
      )}

      {/* Plan identity */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-cairo font-semibold text-text-primary">{plan.displayName}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-cairo text-xs text-text-muted">{plan.code}</span>
            {isFree && (
              <Badge variant="success">
                <CheckCircle2 size={11} className="me-1" />
                {t('adminPlans.badges.free', 'مجاني')}
              </Badge>
            )}
            {!isFree && (
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

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {!reorderMode && (
            <>
              <button
                type="button"
                onClick={() => onEdit(plan)}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                aria-label={t('adminPlansMutations.editPlan')}
                title={t('adminPlansMutations.editPlan')}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => onStatusToggle(plan)}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                aria-label={plan.isActive ? t('adminPlansMutations.deactivatePlan') : t('adminPlansMutations.activatePlan')}
                title={plan.isActive ? t('adminPlansMutations.deactivatePlan') : t('adminPlansMutations.activatePlan')}
              >
                {plan.isActive ? <PowerOff size={15} /> : <Power size={15} />}
              </button>
              <button
                type="button"
                onClick={() => onRecommendedToggle(plan)}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
                aria-label={t('adminPlansMutations.toggleRecommended')}
                title={t('adminPlansMutations.toggleRecommended')}
              >
                <Star size={15} className={plan.isRecommended ? 'fill-yellow-400 text-yellow-400' : ''} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
