import { useTranslation } from 'react-i18next';
import type { UsageSummary } from '@/features/teacher/types/teacherPlans';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  variant?: 'default' | 'warning' | 'danger';
}

function UsageMeter({ label, used, limit, variant = 'default' }: UsageMeterProps) {
  const isUnlimited = limit < 0;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor =
    variant === 'danger' ? 'bg-red-500' : variant === 'warning' ? 'bg-amber-500' : 'bg-cyan-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">
          {isUnlimited ? (
            <span className="text-green-600">غير محدود</span>
          ) : (
            `${used} / ${limit}`
          )}
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

  const isQuizWarning = usage.aiQuizGenerations.limit > 0 && usage.aiQuizGenerations.remaining < 5;
  const isEssayWarning = usage.aiEssayGradings.limit > 0 && usage.aiEssayGradings.remaining < 10;

  return (
    <div className="space-y-4">
      <UsageMeter
        label={t('plans.usage.aiQuizGenerations', 'إنشاء اختبارات بالذكاء الاصطناعي')}
        used={usage.aiQuizGenerations.used}
        limit={usage.aiQuizGenerations.limit}
        variant={isQuizWarning ? 'warning' : 'default'}
      />
      <UsageMeter
        label={t('plans.usage.aiEssayGradings', 'تصحيح الأسئلة المقالية بالذكاء الاصطناعي')}
        used={usage.aiEssayGradings.used}
        limit={usage.aiEssayGradings.limit}
        variant={isEssayWarning ? 'warning' : 'default'}
      />
      <UsageMeter
        label={t('plans.usage.aiContentGenerations', 'إنشاء محتوى تعليمي بالذكاء الاصطناعي')}
        used={usage.aiContentGenerations.used}
        limit={usage.aiContentGenerations.limit}
      />
      <UsageMeter
        label={t('plans.usage.students', 'عدد الطلاب')}
        used={usage.students.used}
        limit={usage.students.limit}
      />
      <UsageMeter
        label={t('plans.usage.storage', 'مساحة التخزين (ميجابايت)')}
        used={usage.storageMb.used}
        limit={usage.storageMb.limit}
      />
    </div>
  );
}
