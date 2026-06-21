import { type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  '5xl': 'max-w-5xl',
  full: 'w-full',
};

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClasses;
  className?: string;
}

export function PageContainer({ children, maxWidth = 'xl', className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6',
        maxWidthClasses[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}
