import { Layers, BookOpen, Users, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { SkeletonBlock } from './SkeletonBlock';

interface TeachingStatsCardProps {
  isLoading: boolean;
  stats: { stages: number; chapters: number; students: number; lessons: number };
  completion: { rate: number; completed: number; total: number };
}

const STAT_TILES = [
  { valueKey: 'stages' as const, labelKey: 'teachingStats.stages', Icon: Layers, bgColor: 'bg-purple-100 text-purple-700' },
  { valueKey: 'chapters' as const, labelKey: 'teachingStats.chapters', Icon: BookOpen, bgColor: 'bg-cyan-100 text-cyan-700' },
  { valueKey: 'students' as const, labelKey: 'teachingStats.students', Icon: Users, bgColor: 'bg-purple-100 text-purple-700' },
  { valueKey: 'lessons' as const, labelKey: 'teachingStats.lessons', Icon: FileText, bgColor: 'bg-cyan-100 text-cyan-700' },
];

export function TeachingStatsCard({ isLoading, stats, completion }: TeachingStatsCardProps) {
  const { t } = useTranslation('profile');

  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <SkeletonBlock className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock variant="circle" className="h-10 w-10 shrink-0" />
              <div className="flex flex-col gap-1.5">
                <SkeletonBlock className="h-5 w-12" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="h-2 w-full rounded-full" />
          <SkeletonBlock className="h-3 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
      <h3 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('teachingStats.title')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {STAT_TILES.map(({ valueKey, labelKey, Icon, bgColor }) => (
          <div key={valueKey} className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bgColor}`}>
              <Icon size={20} />
            </span>
            <div>
              <p className="font-cairo text-h2 font-bold text-navy-900">{toLocalNum(stats[valueKey])}</p>
              <p className="font-cairo text-small text-gray-600">{t(labelKey)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-cairo text-small text-gray-600">{t('teachingStats.completionRate')}</span>
          <span className="font-cairo text-small font-bold text-cyan-600">٪{toLocalNum(completion.rate)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-300">
          <div className="h-2 w-full rounded-full bg-cyan-500" style={{ width: `${completion.rate}%` }} />
        </div>
        <p className="mt-1 font-cairo text-caption text-gray-600">
          {t('teachingStats.completionSub', {
            completed: toLocalNum(completion.completed),
            total: toLocalNum(completion.total),
          })}
        </p>
      </div>
    </div>
  );
}
