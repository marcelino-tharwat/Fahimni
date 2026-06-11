import { type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn('rounded-card bg-surface shadow-sm', paddingClasses[padding], className)}>
      {children}
    </div>
  );
}
