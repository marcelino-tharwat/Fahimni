import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils/cn';

export type FilterValue = 'all' | 'used' | 'unused';

interface FilterTabsProps {
  activeFilter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
  counts: { all: number; used: number; unused: number };
}

const TAB_IDS: FilterValue[] = ['all', 'used', 'unused'];

export function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <div className="flex gap-0 border-b border-gray-300 px-4 pt-3">
      {TAB_IDS.map((id) => {
        const isActive = activeFilter === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={cn(
              'relative px-4 py-2.5 text-sm transition-all duration-150',
              isActive
                ? 'font-bold text-cyan-500'
                : 'font-normal text-gray-500 hover:text-gray-600',
            )}
          >
            {t(`promoCodes.${id}`)}
            <span
              className={cn(
                'ms-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                isActive ? 'bg-cyan-50 text-cyan-500' : 'bg-gray-100 text-gray-500',
              )}
            >
              {counts[id].toLocaleString(locale)}
            </span>
            {isActive && (
              <span className="absolute bottom-0 start-0 end-0 h-0.5 rounded-t-full bg-cyan-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
