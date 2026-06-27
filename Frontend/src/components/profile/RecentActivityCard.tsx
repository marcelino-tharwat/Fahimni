import { useTranslation } from 'react-i18next';
import { Upload, UserPlus, Edit3, File, Trash2, ClipboardCheck } from 'lucide-react';
import { SkeletonBlock } from './SkeletonBlock';
import type { ActivityItem } from '@/types/profile.types';

interface RecentActivityCardProps {
  isLoading: boolean;
  activities: ActivityItem[];
}

const ICON_MAP: Record<ActivityItem['actionKey'], { Icon: typeof Upload; bg: string; color: string }> = {
  upload: { Icon: Upload, bg: 'bg-cyan-100', color: 'text-cyan-700' },
  enrollment: { Icon: UserPlus, bg: 'bg-purple-100', color: 'text-purple-700' },
  edit: { Icon: Edit3, bg: 'bg-warning-50', color: 'text-warning-600' },
  pdf: { Icon: File, bg: 'bg-success-50', color: 'text-success-600' },
  delete: { Icon: Trash2, bg: 'bg-danger-50', color: 'text-danger-500' },
};

export function RecentActivityCard({ isLoading, activities }: RecentActivityCardProps) {
  const { t } = useTranslation('profile');

  return (
    <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-cairo text-h3 font-bold text-navy-900">
          {t('recentActivity.title')}
        </h3>
        {!isLoading && activities.length > 0 && (
          <button
            type="button"
            className="font-cairo text-small text-cyan-600 hover:underline"
          >
            {t('recentActivity.viewAll')}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock variant="circle" className="h-6 w-6 shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
            <ClipboardCheck size={24} className="text-gray-400" />
          </span>
          <h4 className="font-cairo text-h3 font-semibold text-gray-700">
            {t('recentActivity.empty.title')}
          </h4>
          <p className="font-cairo text-body text-gray-500">
            {t('recentActivity.empty.subtitle')}
          </p>
        </div>
      )}

      {!isLoading && activities.length > 0 && (
        <ul className="space-y-4">
          {activities.map((item) => {
            const { Icon, bg, color } = ICON_MAP[item.actionKey];
            return (
              <li key={item.id} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bg}`}>
                  <Icon size={14} className={color} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-cairo text-body font-semibold text-navy-900">
                    {item.title ?? t(`recentActivity.items.${item.actionKey}`)}
                  </p>
                  <p className="font-cairo text-caption text-gray-600">
                    {item.formattedTime ?? t(`recentActivity.timestamps.${item.timestamp}`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
