import { useTranslation } from 'react-i18next';
import { Users, UserCheck, UserX, TrendingUp, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import { localizeDigits } from '@/features/teacher/lib/studentEngagementPresentation';
import type { TeacherStudentsSummary } from '@/features/teacher/types/students';

interface EngagementSummaryCardsProps {
  summary: TeacherStudentsSummary;
  isLoading?: boolean;
}

interface SummaryCard {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  /** Tailwind gradient token, or an inline gradient when no token exists. */
  tileClassName?: string;
  tileStyle?: React.CSSProperties;
}

export function EngagementSummaryCards({ summary, isLoading }: EngagementSummaryCardsProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-3.5 shadow-card"
          >
            <Skeleton className="h-10 w-10 rounded-btn" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const percentSign = locale === 'ar' ? '٪' : '%';

  const cards: SummaryCard[] = [
    {
      key: 'totalStudents',
      label: t('students.summaryCards.totalStudents'),
      value: localizeDigits(summary.totalStudents, locale),
      icon: Users,
      tileClassName: 'bg-cyan-gradient',
    },
    {
      key: 'active',
      label: t('students.summaryCards.active'),
      value: localizeDigits(summary.activeCount, locale),
      icon: UserCheck,
      tileClassName: 'bg-green-gradient',
    },
    {
      key: 'inactive',
      label: t('students.summaryCards.inactive'),
      value: localizeDigits(summary.inactiveCount, locale),
      icon: UserX,
      // No project token for this neutral gray gradient (flagged in the audit).
      tileStyle: { background: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' },
    },
    {
      key: 'averageEngagement',
      label: t('students.summaryCards.averageEngagement'),
      value: `${localizeDigits(summary.averageEngagement, locale)}${percentSign}`,
      icon: TrendingUp,
      tileClassName: 'bg-purple-gradient',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ key, label, value, icon: Icon, tileClassName, tileStyle }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-3.5 shadow-card"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-btn ${tileClassName ?? ''}`}
            style={tileStyle}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-gray-600">{label}</span>
            <span className="text-xl font-bold text-navy-800">{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
