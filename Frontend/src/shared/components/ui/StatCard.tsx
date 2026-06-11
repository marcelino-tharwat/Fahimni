import { type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn('flex items-center gap-4', className)}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent/10">
        <Icon size={24} className="text-accent" />
      </div>
      <div className="flex flex-col">
        <span className="font-cairo text-2xl font-bold text-text-primary">{value}</span>
        <span className="font-cairo text-sm text-text-secondary">{title}</span>
      </div>
    </Card>
  );
}
