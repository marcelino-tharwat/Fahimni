import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { translateApiError } from '@/shared/lib/api/translateError';
import { adminPlansApi } from '@/features/admin/api/adminPlans';
import { useAdminPromoCodes, useAdminPromoMutations } from '@/features/admin/hooks/useAdminPlatformPromoCodes';
import type {
  CreatePromoInput,
  PlatformPromoCode,
  PromoScope,
} from '@/features/admin/types/platformPromoCodes';

type ScopeFilter = 'ALL' | PromoScope;

function ScopeBadge() {
  const { t } = useTranslation();
  return <span data-testid="scope-badge-teacher"><Badge variant="cyan">{t('adminPromoCodes.scopeTeacherPlansBadge')}</Badge></span>;
}

function StatusBadge({ status }: { status: PlatformPromoCode['displayStatus'] }) {
  const { t } = useTranslation();
  if (status === 'EXPIRED') return <span data-testid="status-badge-expired"><Badge variant="warning">{t('adminPromoCodes.statusExpired')}</Badge></span>;
  if (status === 'ACTIVE') return <span data-testid="status-badge-active"><Badge variant="success">{t('adminPromoCodes.statusActive')}</Badge></span>;
  return <span data-testid="status-badge-inactive"><Badge variant="default">{t('adminPromoCodes.statusInactive')}</Badge></span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

function CreatePromoModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { create } = useAdminPromoMutations();
  const scope: PromoScope = 'TEACHER_PLAN';
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY' | 'ALL'>('ALL');
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState('');

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans', 'for-promo'],
    queryFn: () => adminPlansApi.list({}),
    staleTime: 60_000,
  });

  const submit = () => {
    const body: CreatePromoInput = {
      code: code.trim(),
      scope,
      discountType,
      discountValue: Number(discountValue),
      ...(maxUses ? { maxUses: Number(maxUses) } : {}),
      applicablePlanIds: planIds,
      billingInterval,
    };
    create.mutate(body, {
      onSuccess: () => { dispatch(addToast({ type: 'success', message: t('adminPromoCodes.createSuccess') })); onClose(); },
      onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: translateApiError(t, e) })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" onClick={onClose} data-testid="create-promo-modal">
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-modal"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-cairo text-lg font-bold text-navy-900">{t('adminPromoCodes.createTitle')}</h3>
          <button type="button" onClick={onClose} className="rounded-btn p-1.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 font-cairo text-sm text-cyan-800">
            {t('adminPromoCodes.createScopeTeacherPlans')}
          </div>
          <label className="font-cairo text-sm">{t('adminPromoCodes.createCodeLabel')}
            <input data-testid="promo-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('adminPromoCodes.createCodePlaceholder')}
              className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="font-cairo text-sm">{t('adminPromoCodes.createDiscountType')}
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm">
                <option value="PERCENTAGE">{t('adminPromoCodes.createPercent')}</option>
                <option value="FIXED_AMOUNT">{t('adminPromoCodes.createFixed')}</option>
              </select>
            </label>
            <label className="font-cairo text-sm">{t('adminPromoCodes.createDiscountValue')}
              <input data-testid="promo-value-input" type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
            </label>
          </div>
          <label className="font-cairo text-sm">{t('adminPromoCodes.createMaxUses')}
            <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
          </label>

          <div className="flex flex-col gap-3 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3" data-testid="teacher-plan-options">
              <label className="font-cairo text-sm">{t('adminPromoCodes.createBillingInterval')}
                <select data-testid="promo-billing-select" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as 'MONTHLY' | 'YEARLY' | 'ALL')}
                  className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm">
                  <option value="ALL">{t('adminPromoCodes.createBillingAll')}</option>
                  <option value="MONTHLY">{t('adminPromoCodes.createBillingMonthly')}</option>
                  <option value="YEARLY">{t('adminPromoCodes.createBillingYearly')}</option>
                </select>
              </label>
              <div className="font-cairo text-sm">
                {t('adminPromoCodes.createApplicablePlans')}
                <div className="mt-1 flex flex-col gap-1" data-testid="promo-plan-selector">
                  {(plans?.data ?? []).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={planIds.includes(p.id)}
                        onChange={(e) =>
                          setPlanIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                        }
                      />
                      {p.displayName} ({p.code})
                    </label>
                  ))}
                </div>
              </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-btn border border-border px-4 py-2 font-cairo text-sm">{t('adminPromoCodes.createCancel')}</button>
            <button type="button" data-testid="promo-submit" onClick={submit} disabled={create.isPending || !code.trim()}
              className="rounded-btn bg-cyan-gradient px-5 py-2 font-cairo text-sm font-semibold text-white disabled:opacity-50">
              {create.isPending ? t('adminPromoCodes.createSubmitting') : t('adminPromoCodes.createSubmit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

export function AdminPromoCodesManagementPage() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [scope, setScope] = useState<ScopeFilter>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const query = useMemo(() => ({ ...(scope !== 'ALL' ? { scope } : {}), page: 1, limit: 50 }), [scope]);
  const { data, isLoading, isError } = useAdminPromoCodes(query);
  const { changeStatus } = useAdminPromoMutations();
  const rows = (data?.data ?? []) as PlatformPromoCode[];

  const toggle = (p: PlatformPromoCode) =>
    changeStatus.mutate(
      { id: p.id, isActive: !p.isActive },
      { onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: translateApiError(t, e) })) },
    );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" data-testid="admin-promo-codes-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('adminPromoCodes.title')}</h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminPromoCodes.subtitle')}</p>
        </div>
        <button type="button" data-testid="create-promo-btn" onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-btn bg-cyan-gradient px-4 py-2 font-cairo text-sm font-semibold text-white">
          <Plus size={16} /> {t('adminPromoCodes.newCode')}
        </button>
      </div>

      <div className="flex gap-2" role="tablist" data-testid="scope-filter">
        {(['ALL', 'TEACHER_PLAN'] as ScopeFilter[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={scope === s}
            data-testid={`scope-filter-${s}`} onClick={() => setScope(s)}
            className={`rounded-full px-4 py-1.5 font-cairo text-sm ${scope === s ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-text-secondary'}`}>
            {s === 'ALL' ? t('adminPromoCodes.scopeAll') : t('adminPromoCodes.scopeTeacherPlans')}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><p className="font-cairo text-sm text-text-secondary">{t('adminPromoCodes.errorLoading')}</p></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center font-cairo text-sm text-text-muted">{t('adminPromoCodes.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]" data-testid="promo-codes-table">
              <thead className="border-b border-border">
                <tr><Th>{t('adminPromoCodes.colCode')}</Th><Th>{t('adminPromoCodes.colScope')}</Th><Th>{t('adminPromoCodes.colDiscount')}</Th><Th>{t('adminPromoCodes.colUsage')}</Th><Th>{t('adminPromoCodes.colStatus')}</Th><Th>{t('adminPromoCodes.colAction')}</Th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border/60" data-testid="promo-row">
                    <Td><span className="font-mono font-semibold">{p.code}</span></Td>
                    <Td><ScopeBadge /></Td>
                    <Td>{p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `${p.discountValue} ${p.currency}`}</Td>
                    <Td>{p.usedCount}{p.maxUses != null ? ` / ${p.maxUses}` : ''}</Td>
                    <Td><StatusBadge status={p.displayStatus} /></Td>
                    <Td>
                      <button type="button" data-testid="toggle-status-btn" onClick={() => toggle(p)} disabled={changeStatus.isPending}
                        className="rounded-btn border border-border px-3 py-1 font-cairo text-xs disabled:opacity-50">
                        {p.isActive ? t('adminPromoCodes.toggleDeactivate') : t('adminPromoCodes.toggleActivate')}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreatePromoModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
