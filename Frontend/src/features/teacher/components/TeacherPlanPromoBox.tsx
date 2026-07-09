import { useState } from 'react';
import { Loader2, Tag } from 'lucide-react';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import type { PromoPreviewResponse, TeacherPlan } from '@/features/teacher/types/teacherPlans';

interface Props {
  plans: TeacherPlan[];
}

/**
 * Teacher-plan promo application. The teacher picks a paid plan + interval, enters
 * a code, and applies it — the discount is computed server-side (preview). It then
 * proceeds to Paymob checkout with the code (the server re-validates + re-prices).
 * Cross-scope codes (course codes) are rejected server-side.
 */
export function TeacherPlanPromoBox({ plans }: Props) {
  const paidPlans = plans.filter((p) => p.monthlyPrice > 0);
  const [planId, setPlanId] = useState('');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PromoPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    setError(null);
    setPreview(null);
    if (!planId || !code.trim()) return;
    setLoading(true);
    try {
      const res = await teacherPlansApi.previewPromo({ planId, billingInterval, promoCode: code.trim() });
      setPreview(res);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? 'رمز الخصم غير صالح');
    } finally {
      setLoading(false);
    }
  };

  const proceed = async () => {
    if (!planId || !preview) return;
    setLoading(true);
    try {
      const res = await teacherPlansApi.checkout({ planId, billingInterval, promoCode: code.trim() });
      if (res.checkoutUrl) window.location.assign(res.checkoutUrl);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? 'تعذّر بدء الدفع');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-card" data-testid="teacher-plan-promo-box" dir="rtl">
      <div className="mb-3 flex items-center gap-2">
        <Tag size={18} className="text-cyan-600" />
        <h3 className="font-cairo text-base font-bold text-navy-900">لديك رمز خصم؟</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select data-testid="promo-plan-select" value={planId} onChange={(e) => { setPlanId(e.target.value); setPreview(null); }}
          className="h-10 rounded-input border border-border px-3 font-cairo text-sm">
          <option value="">اختر الباقة</option>
          {paidPlans.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
        <select data-testid="promo-interval-select" value={billingInterval} onChange={(e) => { setBillingInterval(e.target.value as 'MONTHLY' | 'YEARLY'); setPreview(null); }}
          className="h-10 rounded-input border border-border px-3 font-cairo text-sm">
          <option value="MONTHLY">شهري</option>
          <option value="YEARLY">سنوي</option>
        </select>
        <input data-testid="promo-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="رمز الخصم"
          className="h-10 rounded-input border border-border px-3 font-cairo text-sm" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" data-testid="promo-apply-btn" onClick={apply} disabled={loading || !planId || !code.trim()}
          className="inline-flex items-center gap-1 rounded-btn bg-cyan-gradient px-4 py-2 font-cairo text-sm font-semibold text-white disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null} تطبيق
        </button>
      </div>

      {error && (
        <p data-testid="promo-error" className="mt-3 rounded-md bg-red-50 px-3 py-2 font-cairo text-sm text-red-700">{error}</p>
      )}

      {preview && (
        <div data-testid="promo-preview" className="mt-3 flex flex-col gap-1 rounded-lg border border-cyan-200 bg-cyan-50 p-3 font-cairo text-sm">
          <div className="flex justify-between"><span>السعر الأصلي</span><span data-testid="promo-original">{preview.originalAmount} {preview.currency}</span></div>
          <div className="flex justify-between text-green-700"><span>الخصم</span><span data-testid="promo-discount">- {preview.discount} {preview.currency}</span></div>
          <div className="flex justify-between font-bold"><span>الإجمالي بعد الخصم</span><span data-testid="promo-final">{preview.amountAfter} {preview.currency}</span></div>
          <button type="button" data-testid="promo-proceed-btn" onClick={proceed} disabled={loading}
            className="mt-2 rounded-btn bg-purple-gradient px-4 py-2 font-cairo text-sm font-semibold text-white disabled:opacity-50">
            المتابعة للدفع
          </button>
        </div>
      )}
    </div>
  );
}
