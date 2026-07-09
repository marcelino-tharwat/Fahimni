import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { adminPlansApi } from '@/features/admin/api/adminPlans';
import { useAdminPromoCodes, useAdminPromoMutations } from '@/features/admin/hooks/useAdminPlatformPromoCodes';
import type {
  CreatePromoInput,
  PlatformPromoCode,
  PromoScope,
} from '@/features/admin/types/platformPromoCodes';

type ScopeFilter = 'ALL' | PromoScope;

function ScopeBadge({ scope }: { scope: PromoScope }) {
  return scope === 'TEACHER_PLAN' ? (
    <span data-testid="scope-badge-teacher"><Badge variant="cyan">باقات مدرسين</Badge></span>
  ) : (
    <span data-testid="scope-badge-course"><Badge variant="default">كورسات</Badge></span>
  );
}

function StatusBadge({ status }: { status: PlatformPromoCode['displayStatus'] }) {
  if (status === 'EXPIRED') return <span data-testid="status-badge-expired"><Badge variant="warning">منتهي</Badge></span>;
  if (status === 'ACTIVE') return <span data-testid="status-badge-active"><Badge variant="success">نشط</Badge></span>;
  return <span data-testid="status-badge-inactive"><Badge variant="default">غير نشط</Badge></span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

function CreatePromoModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { create } = useAdminPromoMutations();
  const [scope, setScope] = useState<PromoScope>('COURSE_PURCHASE');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY' | 'ALL'>('ALL');
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState('');

  // Teacher plans for the TEACHER_PLAN plan selector.
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
      ...(scope === 'TEACHER_PLAN' ? { applicablePlanIds: planIds, billingInterval } : {}),
    };
    create.mutate(body, {
      onSuccess: () => { dispatch(addToast({ type: 'success', message: 'تم إنشاء رمز الخصم' })); onClose(); },
      onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: e.message ?? 'تعذّر الإنشاء' })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose} data-testid="create-promo-modal">
      <div className="w-full max-w-lg rounded-card bg-white p-6 shadow-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-cairo text-lg font-bold text-navy-900">إنشاء رمز خصم</h3>
          <button type="button" onClick={onClose} className="rounded-btn p-1.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="font-cairo text-sm">النطاق
            <select data-testid="promo-scope-select" value={scope} onChange={(e) => setScope(e.target.value as PromoScope)}
              className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm">
              <option value="COURSE_PURCHASE">كورسات (COURSE_PURCHASE)</option>
              <option value="TEACHER_PLAN">باقات مدرسين (TEACHER_PLAN)</option>
            </select>
          </label>
          <label className="font-cairo text-sm">الرمز
            <input data-testid="promo-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER20"
              className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-cairo text-sm">نوع الخصم
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm">
                <option value="PERCENTAGE">نسبة %</option>
                <option value="FIXED_AMOUNT">مبلغ ثابت</option>
              </select>
            </label>
            <label className="font-cairo text-sm">القيمة
              <input data-testid="promo-value-input" type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
            </label>
          </div>
          <label className="font-cairo text-sm">الحد الأقصى للاستخدام (اختياري)
            <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm" />
          </label>

          {scope === 'TEACHER_PLAN' && (
            <div className="flex flex-col gap-3 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3" data-testid="teacher-plan-options">
              <label className="font-cairo text-sm">فترة الفوترة
                <select data-testid="promo-billing-select" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as 'MONTHLY' | 'YEARLY' | 'ALL')}
                  className="mt-1 h-10 w-full rounded-input border border-border px-3 text-sm">
                  <option value="ALL">الكل</option>
                  <option value="MONTHLY">شهري</option>
                  <option value="YEARLY">سنوي</option>
                </select>
              </label>
              <div className="font-cairo text-sm">
                الباقات المشمولة (فارغ = كل الباقات)
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
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-btn border border-border px-4 py-2 font-cairo text-sm">إلغاء</button>
            <button type="button" data-testid="promo-submit" onClick={submit} disabled={create.isPending || !code.trim()}
              className="rounded-btn bg-cyan-gradient px-5 py-2 font-cairo text-sm font-semibold text-white disabled:opacity-50">
              {create.isPending ? 'جارٍ الحفظ...' : 'إنشاء'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPromoCodesManagementPage() {
  const dispatch = useAppDispatch();
  const [scope, setScope] = useState<ScopeFilter>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const query = useMemo(() => ({ ...(scope !== 'ALL' ? { scope } : {}), page: 1, limit: 50 }), [scope]);
  const { data, isLoading, isError } = useAdminPromoCodes(query);
  const { changeStatus } = useAdminPromoMutations();
  const rows = (data?.data ?? []) as PlatformPromoCode[];

  const toggle = (p: PlatformPromoCode) =>
    changeStatus.mutate(
      { id: p.id, isActive: !p.isActive },
      { onError: (e: ApiError) => dispatch(addToast({ type: 'error', message: e.message ?? 'تعذّر التحديث' })) },
    );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir="rtl" data-testid="admin-promo-codes-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">أكواد الخصم</h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">أكواد خصم منفصلة النطاق: كورسات الطلاب وباقات المدرسين</p>
        </div>
        <button type="button" data-testid="create-promo-btn" onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-btn bg-cyan-gradient px-4 py-2 font-cairo text-sm font-semibold text-white">
          <Plus size={16} /> رمز جديد
        </button>
      </div>

      <div className="flex gap-2" role="tablist" data-testid="scope-filter">
        {(['ALL', 'COURSE_PURCHASE', 'TEACHER_PLAN'] as ScopeFilter[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={scope === s}
            data-testid={`scope-filter-${s}`} onClick={() => setScope(s)}
            className={`rounded-full px-4 py-1.5 font-cairo text-sm ${scope === s ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-text-secondary'}`}>
            {s === 'ALL' ? 'الكل' : s === 'COURSE_PURCHASE' ? 'كورسات' : 'باقات مدرسين'}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><p className="font-cairo text-sm text-text-secondary">تعذّر تحميل الأكواد</p></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center font-cairo text-sm text-text-muted">لا توجد أكواد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="promo-codes-table">
              <thead className="border-b border-border">
                <tr><Th>الرمز</Th><Th>النطاق</Th><Th>الخصم</Th><Th>الاستخدام</Th><Th>الحالة</Th><Th>إجراء</Th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border/60" data-testid="promo-row">
                    <Td><span className="font-mono font-semibold">{p.code}</span></Td>
                    <Td><ScopeBadge scope={p.scope} /></Td>
                    <Td>{p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `${p.discountValue} ${p.currency}`}</Td>
                    <Td>{p.usedCount}{p.maxUses != null ? ` / ${p.maxUses}` : ''}</Td>
                    <Td><StatusBadge status={p.displayStatus} /></Td>
                    <Td>
                      <button type="button" data-testid="toggle-status-btn" onClick={() => toggle(p)} disabled={changeStatus.isPending}
                        className="rounded-btn border border-border px-3 py-1 font-cairo text-xs disabled:opacity-50">
                        {p.isActive ? 'إيقاف' : 'تفعيل'}
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
