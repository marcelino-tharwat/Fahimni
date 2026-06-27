import { cn } from '@/shared/lib/utils/cn';

interface SkeletonBlockProps {
  variant?: 'text' | 'circle' | 'rect';
  className?: string;
}

export function SkeletonBlock({ variant = 'text', className }: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-300',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded-md',
        variant === 'rect' && 'rounded-md',
        className,
      )}
    />
  );
}
