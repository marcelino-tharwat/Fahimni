import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import { translateApiError } from '@/shared/lib/api/translateError';
import { TeacherPlansCurrentPlanCard } from './TeacherPlansCurrentPlanCard';
import { TeacherPlanPromoBox } from '@/features/teacher/components/TeacherPlanPromoBox';
import type { TeacherPlan, SubscriptionMeResponse } from '@/features/teacher/types/teacherPlans';

const ENTRY_CODES = new Set(['FREE', 'BASIC']);

function isEntryTier(code: string): boolean {
  return ENTRY_CODES.has(code);
}

export function TeacherPlansPage() {
  const { t } = useTranslation('teacher');
  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [paymentUnavailable, setPaymentUnavailable] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'ONLINE' | 'PROMO'>>({});
  const [promoCodes, setPromoCodes] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, subData] = await Promise.all([
        teacherPlansApi.getPlans(),
        teacherPlansApi.getMySubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('plans.loadError', 'حدث خطأ في تحميل البيانات');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Primary paid flow: create a real checkout session and redirect to the
  // payment provider. The subscription only becomes ACTIVE after the verified
  // provider webhook — so no success message is shown here (no fake success).
  const handleCheckout = async (planId: string) => {
    setSubscribing(planId);
    setErrorField(null);
    setSuccessMsg(null);
    setPaymentUnavailable(false);
    try {
      const method = paymentMethods[planId] ?? 'ONLINE';
      const promoCode = method === 'PROMO' ? promoCodes[planId]?.trim() : undefined;
      const result = await teacherPlansApi.checkout({ planId, billingInterval, promoCode });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return; // navigating away — keep the button in its loading state
      }
      if (result.status === 'SUCCESS') {
        setSuccessMsg(t('plans.promoActivated', 'تم تفعيل الاشتراك باستخدام كود الخصم'));
        await fetchData();
      } else {
        setPaymentUnavailable(true);
      }
      setSubscribing(null);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message?: string };
      if (
        e.code === 'PAYMENT_PROVIDER_UNAVAILABLE' ||
        e.statusCode === 502 ||
        e.statusCode === 503
      ) {
        setPaymentUnavailable(true);
      } else {
        setErrorField(translateApiError(t, err));
      }
      setSubscribing(null);
    }
  };

  // Secondary/fallback flow: ask the admin to review a manual subscription
  // request. Not the primary paid path.
  const handleManualRequest = async (planId: string) => {
    setRequesting(planId);
    setErrorField(null);
    setSuccessMsg(null);
    try {
      const result = await teacherPlansApi.createRequest({ planId, billingInterval });
      setSuccessMsg(result.message);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('plans.requestError', 'حدث خطأ في إرسال الطلب');
      setErrorField(msg);
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-5 w-72 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-card bg-surface p-5 shadow-card">
              <div className="mb-4 h-4 w-16 rounded-badge bg-gray-200" />
              <div className="mb-2 h-8 w-24 rounded bg-gray-200" />
              <div className="mb-6 h-4 w-36 rounded bg-gray-200" />
              <div className="mb-4 h-10 rounded-btn bg-gray-200" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 rounded bg-gray-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
        <p className="mb-4 text-gray-600">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
        >
          {t('common:status.retry', 'إعادة المحاولة')}
        </button>
      </div>
    );
  }

  const currentPlanId = subscription?.currentPlan?.id;
  const pendingRequestPlanCode = subscription?.pendingRequest?.planCode;
  const pendingPaymentPlanCode = subscription?.pendingPayment?.planCode;

  const isCurrentPlan = (plan: TeacherPlan) => plan.id === currentPlanId;
  const hasPendingRequest = (plan: TeacherPlan) => plan.code === pendingRequestPlanCode;
  const hasPendingPayment = (plan: TeacherPlan) => plan.code === pendingPaymentPlanCode;
  const isDisabled = (plan: TeacherPlan) =>
    isCurrentPlan(plan) ||
    hasPendingPayment(plan) ||
    hasPendingRequest(plan) ||
    subscribing === plan.id;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('plans.pageTitle', 'الباقات والاشتراكات')}
        </h1>
        <p className="mt-1 text-gray-500">
          {t('plans.pageSubtitle', 'اختر الباقة المناسبة لاستخدام أدوات فهمني')}
        </p>
      </div>

      {subscription?.accessState === 'FREE_PLAN' && (
        <div
          className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800"
          data-testid="upgrade-banner"
        >
          {t('plans.freePlanUpgradeBanner', 'أنت تستخدم الباقة المجانية. يمكنك الترقية في أي وقت للحصول على مزايا أكثر.')}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {errorField && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorField}
        </div>
      )}

      {paymentUnavailable && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t('plans.paymentUnavailable', 'الدفع الإلكتروني غير مفعل حاليًا')}
        </div>
      )}

      {subscription?.pendingPayment && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              {t('plans.paymentPendingAlert', 'لديك عملية دفع بانتظار التأكيد لباقة {{plan}}', {
                plan: subscription.pendingPayment.planCode,
              })}
            </span>
            {subscription.pendingPayment.checkoutUrl && (
              <a
                href={subscription.pendingPayment.checkoutUrl}
                className="text-sm font-semibold text-amber-900 underline"
              >
                {t('plans.completePayment', 'أكمل الدفع')}
              </a>
            )}
          </div>
        </Card>
      )}

      {subscription?.pendingRequest && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              {t('plans.pendingRequestAlert', 'لديك طلب اشتراك قيد المراجعة لباقة {{plan}}', {
                plan: subscription.pendingRequest.planCode,
              })}
            </span>
          </div>
        </Card>
      )}

      <TeacherPlansCurrentPlanCard data={subscription} />

      {plans.length > 0 && <TeacherPlanPromoBox plans={plans} />}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => setBillingInterval(billingInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
          className="inline-flex items-center rounded-full bg-gray-100 p-1 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none"
        >
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              billingInterval === 'MONTHLY'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted'
            }`}
          >
            {t('plans.monthly', 'شهري')}
          </span>
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              billingInterval === 'YEARLY'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted'
            }`}
          >
            {t('plans.yearly', 'سنوي')}
          </span>
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = billingInterval === 'YEARLY' && plan.yearlyPrice != null
            ? plan.yearlyPrice
            : plan.monthlyPrice;
          const isFree = price === 0;
          const entry = isEntryTier(plan.code);
          const buttonDisabled = isDisabled(plan) || isFree;

          return (
            <Card
              key={plan.id}
              className={`relative flex h-full flex-col overflow-visible p-5 transition-shadow hover:shadow-elevated ${
                plan.isRecommended
                  ? 'ring-2 ring-cyan-500 shadow-glow'
                  : entry
                    ? 'border-gray-200'
                    : 'border-purple-200'
              }`}
            >
              {plan.isRecommended && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-badge bg-cyan-500 px-3 py-0.5 text-xs font-bold text-white">
                  {t('plans.recommended', 'مقترح')}
                </span>
              )}

              <span
                className={`self-start rounded-badge px-3 py-0.5 text-xs font-semibold ${
                  entry
                    ? 'bg-cyan-50 text-cyan-600'
                    : 'bg-purple-50 text-purple-600'
                }`}
              >
                {t(`plans.planNames.${plan.code}`, plan.displayName)}
              </span>

              <div className="mb-4 mt-3">
                <span className="text-4xl font-bold text-text-primary">
                  {isFree ? 0 : price}
                </span>
                <span className="me-1 text-sm text-text-muted">
                  {plan.currency}
                  {billingInterval === 'YEARLY' && plan.yearlyPrice != null
                    ? `/${t('plans.year', 'سنة')}`
                    : `/${t('plans.month', 'شهر')}`}
                </span>
              </div>

              {billingInterval === 'YEARLY' && plan.yearlyPrice != null && plan.monthlyPrice > 0 && (
                <p className="mb-4 text-xs text-success-500">
                  {t('plans.savePercent', 'وفر {{percent}}%', {
                    percent: Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100),
                  })}
                </p>
              )}

              <p className="mb-4 text-sm text-text-secondary">{t(`plans.planDescs.${plan.code}`, plan.description ?? '')}</p>

              {!isFree && !isCurrentPlan(plan) && !hasPendingPayment(plan) && !hasPendingRequest(plan) && (
                <div className="mb-3 rounded-card border border-border bg-gray-50 p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-text-secondary">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`payment-method-${plan.id}`}
                        checked={(paymentMethods[plan.id] ?? 'ONLINE') === 'ONLINE'}
                        onChange={() => setPaymentMethods((prev) => ({ ...prev, [plan.id]: 'ONLINE' }))}
                      />
                      {t('plans.payOnline', 'الدفع أونلاين')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`payment-method-${plan.id}`}
                        checked={paymentMethods[plan.id] === 'PROMO'}
                        onChange={() => setPaymentMethods((prev) => ({ ...prev, [plan.id]: 'PROMO' }))}
                      />
                      {t('plans.usePromoCode', 'استخدام كود خصم / كود اشتراك')}
                    </label>
                  </div>
                  {paymentMethods[plan.id] === 'PROMO' && (
                    <input
                      value={promoCodes[plan.id] ?? ''}
                      onChange={(e) => setPromoCodes((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                      placeholder={t('plans.promoCodePlaceholder', 'كود الخصم')}
                      className="mt-3 h-10 w-full rounded-input border border-border bg-white px-3 font-cairo text-sm outline-none focus:border-accent"
                    />
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={buttonDisabled || (paymentMethods[plan.id] === 'PROMO' && !promoCodes[plan.id]?.trim())}
                className={`min-h-[44px] w-full rounded-btn font-cairo text-sm font-semibold transition-all focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed ${
                  isCurrentPlan(plan)
                    ? 'bg-gray-100 text-gray-500'
                    : hasPendingPayment(plan)
                      ? 'border border-warning-500 bg-warning-50 text-warning-600'
                      : hasPendingRequest(plan)
                        ? 'border border-warning-500 bg-warning-50 text-warning-600'
                        : entry
                          ? 'bg-cyan-gradient text-white hover:opacity-90'
                          : 'bg-purple-gradient text-white hover:opacity-90'
                }`}
              >
                {subscribing === plan.id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrentPlan(plan) ? (
                  t('plans.currentPlanBadge', 'الباقة الحالية')
                ) : hasPendingPayment(plan) ? (
                  t('plans.paymentPending', 'بانتظار تأكيد الدفع')
                ) : hasPendingRequest(plan) ? (
                  t('plans.pendingBadge', 'قيد المراجعة')
                ) : isFree ? (
                  t('plans.getStarted', 'ابدأ مجاناً')
                ) : (
                  paymentMethods[plan.id] === 'PROMO'
                    ? t('plans.applyPromo', 'تفعيل بالكود')
                    : t('plans.payNow', 'ادفع الآن')
                )}
              </button>

              {/* Secondary/fallback: manual admin review (not the main paid flow). */}
              {!isFree && !isCurrentPlan(plan) && !hasPendingPayment(plan) && !hasPendingRequest(plan) && (
                <button
                  type="button"
                  onClick={() => handleManualRequest(plan.id)}
                  disabled={requesting === plan.id}
                  className="mt-2 w-full text-xs font-medium text-text-muted underline transition-colors hover:text-text-secondary disabled:cursor-not-allowed"
                >
                  {requesting === plan.id
                    ? t('plans.sending', 'جاري الإرسال...')
                    : t('plans.requestManualReview', 'أو اطلب مراجعة يدوية من الإدارة')}
                </button>
              )}

              <div className="mt-4 flex-1 rounded-card bg-gray-50 px-5 py-4">
                <ul className="space-y-3">
                  {Object.entries(plan.features)
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => (
                      <li key={key} className="flex items-start gap-3 text-sm text-text-secondary">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                        <span>{t(`plans.planFeatures.${plan.code}.${key}`, key)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && !loading && (
        <div className="py-12 text-center text-gray-500">
          {t('plans.noPlans', 'لا توجد باقات متاحة حالياً')}
        </div>
      )}
    </div>
  );
}
