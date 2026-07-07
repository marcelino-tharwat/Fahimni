import { useTranslation } from 'react-i18next';
import type { UsageSummary } from '@/features/teacher/types/teacherPlans';

function getBarColor(used: number, limit: number): string {
  if (limit <= 0) return 'bg-gray-200';
  const pct = (used / limit) * 100;
  if (pct >= 95) return 'bg-danger-500';
  if (pct >= 80) return 'bg-warning-500';
  return 'bg-cyan-500';
}

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
}

function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const { t } = useTranslation('teacher');

  if (limit === 0) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-400">{t('plans.usage.notIncluded')}</span>
      </div>
    );
  }

  const isUnlimited = limit < 0;
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const barColor = getBarColor(used, limit);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className={isUnlimited ? 'font-medium text-cyan-600' : 'font-medium text-gray-900'}>
          {isUnlimited ? t('plans.unlimited', 'غير محدود') : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface Props {
  usage: UsageSummary | null;
  isLoading?: boolean;
}

export function TeacherPlansUsageMeters({ usage, isLoading }: Props) {
  const { t } = useTranslation('teacher');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!usage) return null;

  return (
    <div className="space-y-4">
      <UsageMeter
        label={t('plans.usage.aiQuizGenerations')}
        used={usage.aiQuizGenerations.used}
        limit={usage.aiQuizGenerations.limit}
      />
      <UsageMeter
        label={t('plans.usage.aiEssayGradings')}
        used={usage.aiEssayGradings.used}
        limit={usage.aiEssayGradings.limit}
      />
      <UsageMeter
        label={t('plans.usage.aiContentGenerations')}
        used={usage.aiContentGenerations.used}
        limit={usage.aiContentGenerations.limit}
      />
      <UsageMeter
        label={t('plans.usage.students')}
        used={usage.students.used}
        limit={usage.students.limit}
      />
      <UsageMeter
        label={t('plans.usage.storage')}
        used={usage.storageMb.used}
        limit={usage.storageMb.limit}
      />
    </div>
  );
}
