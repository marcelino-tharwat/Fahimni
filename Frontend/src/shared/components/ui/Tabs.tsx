import { cn } from '@/shared/lib/utils/cn';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn('flex gap-2 border-b border-border', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 font-cairo text-sm font-medium transition-colors',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
