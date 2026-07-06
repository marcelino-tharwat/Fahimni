import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button, Card, Badge, Spinner } from '@/shared/components/ui';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import { TeacherPlansCurrentPlanCard } from './TeacherPlansCurrentPlanCard';
import type { TeacherPlan, SubscriptionMeResponse } from '@/features/teacher/types/teacherPlans';

export function TeacherPlansPage() {
  const { t } = useTranslation('teacher');
  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);

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

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    setErrorField(null);
    setSuccessMsg(null);
    try {
      const result = await teacherPlansApi.createRequest({
        planId,
        billingInterval,
      });
      setSuccessMsg(result.message);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('plans.requestError', 'حدث خطأ في إرسال الطلب');
      setErrorField(msg);
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
        <p className="mb-4 text-gray-600">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          {t('common:status.retry', 'إعادة المحاولة')}
        </Button>
      </div>
    );
  }

  const currentPlanId = subscription?.currentPlan?.id;
  const pendingRequestPlanCode = subscription?.pendingRequest?.planCode;

  const isCurrentPlan = (plan: TeacherPlan) => plan.id === currentPlanId;
  const hasPendingRequest = (plan: TeacherPlan) => plan.code === pendingRequestPlanCode;
  const isDisabled = (plan: TeacherPlan) => isCurrentPlan(plan) || hasPendingRequest(plan) || subscribing === plan.id;

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

      <div className="flex items-center justify-center gap-2">
        <span className={`text-sm ${billingInterval === 'MONTHLY' ? 'font-bold text-navy-600' : 'text-gray-400'}`}>
          {t('plans.monthly', 'شهري')}
        </span>
        <button
          type="button"
          onClick={() => setBillingInterval(billingInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
          className={`relative h-6 w-12 rounded-full transition-colors ${
            billingInterval === 'YEARLY' ? 'bg-navy-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              billingInterval === 'YEARLY' ? 'translate-x-6' : ''
            }`}
          />
        </button>
        <span className={`text-sm ${billingInterval === 'YEARLY' ? 'font-bold text-navy-600' : 'text-gray-400'}`}>
          {t('plans.yearly', 'سنوي')}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = billingInterval === 'YEARLY' && plan.yearlyPrice != null
            ? plan.yearlyPrice
            : plan.monthlyPrice;
          const isFree = price === 0;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col p-6 transition-shadow hover:shadow-lg ${
                plan.isRecommended ? 'ring-2 ring-navy-500' : ''
              }`}
            >
              {plan.isRecommended && (
                <Badge variant="success" className="absolute -top-2 left-1/2 -translate-x-1/2">
                  {t('plans.recommended', 'مقترح')}
                </Badge>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.displayName}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-navy-600">
                  {isFree ? 0 : price}
                </span>
                <span className="mr-1 text-sm text-gray-400">
                  {plan.currency}
                  {billingInterval === 'YEARLY' && plan.yearlyPrice != null
                    ? `/${t('plans.year', 'سنة')}`
                    : `/${t('plans.month', 'شهر')}`}
                </span>
              </div>

              {billingInterval === 'YEARLY' && plan.yearlyPrice != null && plan.monthlyPrice > 0 && (
                <p className="mb-4 text-xs text-green-600">
                  {t('plans.savePercent', 'وفر {{percent}}%', {
                    percent: Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100),
                  })}
                </p>
              )}

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isDisabled(plan)}
                variant={isCurrentPlan(plan) ? 'outline' : plan.isRecommended ? 'primary' : 'secondary'}
                className="w-full"
              >
                {subscribing === plan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrentPlan(plan) ? (
                  t('plans.currentPlanBadge', 'الباقة الحالية')
                ) : hasPendingRequest(plan) ? (
                  t('plans.pendingBadge', 'قيد المراجعة')
                ) : isFree ? (
                  t('plans.getStarted', 'ابدأ مجاناً')
                ) : (
                  t('plans.subscribe', 'طلب الاشتراك')
                )}
              </Button>
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
