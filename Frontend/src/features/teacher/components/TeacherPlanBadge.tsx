import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sparkles, Crown } from 'lucide-react';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';

/**
 * Compact plan indicator shown in the teacher layout. An APPROVED teacher on the
 * FREE plan is fully active (not blocked) — the badge simply advertises an
 * optional upgrade. A paid teacher sees their plan name with no upgrade CTA.
 */
export function TeacherPlanBadge() {
  const { t } = useTranslation('teacher');

  const { data } = useQuery({
    queryKey: ['teacher', 'subscription', 'me', 'badge'],
    queryFn: teacherPlansApi.getMySubscription,
    staleTime: 30_000,
  });

  if (!data) return null;

  if (data.accessState === 'FREE_PLAN') {
    return (
      <div
        data-testid="free-plan-badge"
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm"
      >
        <span className="flex items-center gap-2 font-semibold text-cyan-800">
          <Sparkles className="h-4 w-4" />
          {t('plans.freePlanLabel', 'الباقة المجانية')}
        </span>
        {data.upgradeAvailable && (
          <Link
            to="/teacher/plans"
            data-testid="upgrade-cta"
            className="rounded-btn bg-cyan-gradient px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('plans.upgradeCta', 'ترقية الباقة')}
          </Link>
        )}
      </div>
    );
  }

  if (data.accessState === 'PAID_PLAN') {
    return (
      <div
        data-testid="paid-plan-badge"
        className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800"
      >
        <Crown className="h-4 w-4" />
        {t(`plans.planNames.${data.currentPlan.code}`, data.currentPlan.displayName)}
      </div>
    );
  }

  return null;
}
