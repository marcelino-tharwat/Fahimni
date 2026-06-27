import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { SkeletonBlock } from './SkeletonBlock';
import type { GradeEngagement } from '@/types/profile.types';

interface StudentEngagementCardProps {
  isLoading: boolean;
  totalEnrolled: number;
  trend: number;
  grades: readonly GradeEngagement[];
}

export function StudentEngagementCard({ isLoading, totalEnrolled, trend, grades }: StudentEngagementCardProps) {
  const { t } = useTranslation('profile');

  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <SkeletonBlock className="mb-4 h-5 w-36" />
        <SkeletonBlock variant="rect" className="mb-5 h-20 w-full rounded-lg" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const gradeSuffix = (count: number) =>
    count > 10 ? t('studentEngagement.students') : t('studentEngagement.student');

  return (
    <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
      <h3 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('studentEngagement.title')}
      </h3>

      <div className="mb-5 flex items-center justify-between rounded-lg bg-navy-900 p-4">
        <div>
          <p className="font-cairo text-caption text-gray-300">
            {t('studentEngagement.totalStudents')}
          </p>
          <p className="font-cairo text-h2 font-bold text-white">
            {toLocalNum(totalEnrolled)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-navy-700 px-3 py-1 font-cairo text-small text-cyan-400">
            {trend > 0 ? `${toLocalNum(trend)}↑` : `${toLocalNum(Math.abs(trend))}↓`}٪
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500">
            <Users size={20} className="text-white" />
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {grades.map(({ labelKey, count, percentage, barColor }) => (
          <div key={labelKey}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-cairo text-body text-navy-900">{t(labelKey)}</span>
              <span className="font-cairo text-small text-gray-600">
                {toLocalNum(count)} {gradeSuffix(count)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-gray-300">
                <div
                  className={`h-2 rounded-full ${barColor}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-end font-cairo text-small font-semibold text-gray-700">
                {toLocalNum(percentage)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        {grades.map(({ labelKey, barColor }) => (
          <div key={labelKey} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${barColor}`} />
            <span className="font-cairo text-caption text-gray-600">{t(labelKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
