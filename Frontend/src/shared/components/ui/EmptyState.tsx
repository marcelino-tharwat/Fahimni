import { type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}
    >
      {Icon && <Icon size={48} className="text-gray-400" />}
      <h3 className="font-cairo text-lg font-medium text-text-primary">{title}</h3>
      {description && <p className="font-cairo text-sm text-text-secondary">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
