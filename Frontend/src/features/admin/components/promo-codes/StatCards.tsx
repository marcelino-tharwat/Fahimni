import { Ticket, CheckCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { cn } from '@/shared/lib/utils/cn';

interface StatCardsProps {
  total: number;
  used: number;
  available: number;
  isLoading?: boolean;
}

interface StatCard {
  icon: typeof Ticket;
  iconBg: string;
  value: number;
  label: string;
}

export function StatCards({ total, used, available, isLoading }: StatCardsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  const cards: StatCard[] = [
    {
      icon: Ticket,
      iconBg: 'bg-cyan-gradient',
      value: total,
      label: t('promoCodes.totalCodes'),
    },
    {
      icon: CheckCircle,
      iconBg: 'bg-[linear-gradient(135deg,#10B981,#059669)]',
      value: used,
      label: t('promoCodes.usedCodes'),
    },
    {
      icon: Clock,
      iconBg: 'bg-purple-gradient',
      value: available,
      label: t('promoCodes.availableCodes'),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ icon: Icon, iconBg, value, label }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-4 shadow-card"
        >
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white',
              iconBg,
            )}
          >
            <Icon size={16} />
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-12 rounded" />
            ) : (
              <p className="text-xl font-bold text-navy-800">
                {value.toLocaleString(locale)}
              </p>
            )}
            <p className="text-xs text-gray-600">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
