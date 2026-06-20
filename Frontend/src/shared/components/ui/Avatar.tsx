import { cn } from '@/shared/lib/utils/cn';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
 const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-navy-700 font-cairo font-medium text-white',
        sizeClasses[size],
        className,
      )}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
