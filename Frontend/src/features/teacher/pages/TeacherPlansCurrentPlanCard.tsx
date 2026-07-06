import { useTranslation } from 'react-i18next';
import { Card, Badge } from '@/shared/components/ui';
import { TeacherPlansUsageMeters } from './TeacherPlansUsageMeters';
import type { SubscriptionMeResponse } from '@/features/teacher/types/teacherPlans';

interface Props {
  data: SubscriptionMeResponse | null;
  isLoading?: boolean;
}

export function TeacherPlansCurrentPlanCard({ data, isLoading }: Props) {
  const { t } = useTranslation('teacher');

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-32 animate-pulse rounded bg-gray-100" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6 text-center text-gray-500">
        {t('plans.noData', 'لا تتوفر بيانات الاشتراك')}
      </Card>
    );
  }

  const statusLabel: Record<string, string> = {
    TRIALING: t('plans.statusTrialing', 'تجريبي'),
    ACTIVE: t('plans.statusActive', 'نشط'),
    PAST_DUE: t('plans.statusPastDue', 'متأخر الدفع'),
    CANCELLED: t('plans.statusCancelled', 'ملغي'),
    EXPIRED: t('plans.statusExpired', 'منتهي'),
  };

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    TRIALING: 'warning',
    ACTIVE: 'success',
    PAST_DUE: 'danger',
    CANCELLED: 'default',
    EXPIRED: 'danger',
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {t('plans.currentPlan', 'الباقة الحالية')}
          </h3>
          <p className="text-2xl font-bold text-navy-600">{data.currentPlan.displayName}</p>
        </div>
        {data.subscription && (
          <Badge variant={statusColor[data.subscription.status] ?? 'default'}>
            {statusLabel[data.subscription.status] ?? data.subscription.status}
          </Badge>
        )}
        {!data.subscription && (
          <Badge variant="default">
            {t('plans.freePlan', 'مجانية')}
          </Badge>
        )}
      </div>

      {data.subscription && (
        <div className="mb-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="block text-xs text-gray-400">
              {t('plans.periodStart', 'بداية الدورة')}
            </span>
            {new Date(data.subscription.currentPeriodStart).toLocaleDateString('ar-EG')}
          </div>
          <div>
            <span className="block text-xs text-gray-400">
              {t('plans.periodEnd', 'نهاية الدورة')}
            </span>
            {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('ar-EG')}
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">
          {t('plans.usageTitle', 'استخدام الباقة')}
        </h4>
        <TeacherPlansUsageMeters usage={data.usage} />
      </div>
    </Card>
  );
}
