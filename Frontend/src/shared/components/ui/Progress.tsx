import { cn } from '@/shared/lib/utils/cn';

interface ProgressProps {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const heightClasses: Record<NonNullable<ProgressProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-2',
};

export function Progress({ value, size = 'md', showLabel = false, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 overflow-hidden rounded-full bg-gray-200', heightClasses[size])}>
        <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && (
        <span className="font-cairo text-sm text-text-secondary">{Math.round(clamped)}%</span>
      )}
    </div>
  );
}
