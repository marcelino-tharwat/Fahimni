import { useTranslation } from 'react-i18next';
import { BookOpen, PlayCircle, Award, Clock, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import {
  localizeDigits,
  formatRelativeTime,
  getLessonProgressColorClass,
} from '@/features/teacher/lib/studentEngagementPresentation';
import type { TeacherStudentDetailSummary } from '@/features/teacher/types/studentDetail';

interface StudentDetailStatCardsProps {
  summary: TeacherStudentDetailSummary | undefined;
  isLoading?: boolean;
}

interface StatCardDef {
  key: string;
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tileClassName?: string;
  tileStyle?: React.CSSProperties;
  /** Progress bar fill class + percent — only the "lessons watched" card. */
  progress?: { colorClass: string; percent: number };
}

export function StudentDetailStatCards({ summary, isLoading }: StudentDetailStatCardsProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-4 shadow-card"
          >
            <Skeleton className="h-11 w-11 rounded-btn" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const percentSign = locale === 'ar' ? '٪' : '%';

  const lessonsPercent =
    summary.totalLessons > 0 ? (summary.lessonsWatched / summary.totalLessons) * 100 : 0;

  const cards: StatCardDef[] = [
    {
      key: 'chapters',
      label: t('students.detail.summaryCards.chapters'),
      value: localizeDigits(summary.enrolledChapterCount, locale),
      icon: BookOpen,
      tileClassName: 'bg-cyan-gradient',
    },
    {
      key: 'lessonsWatched',
      label: t('students.detail.summaryCards.lessonsWatched'),
      value: `${localizeDigits(summary.lessonsWatched, locale)}/${localizeDigits(
        summary.totalLessons,
        locale,
      )}`,
      icon: PlayCircle,
      tileClassName: 'bg-green-gradient',
      progress: {
        colorClass: getLessonProgressColorClass(summary.lessonsWatched, summary.totalLessons),
        percent: lessonsPercent,
      },
    },
    {
      key: 'avgScore',
      label: t('students.detail.summaryCards.avgScore'),
      value:
        summary.averageQuizScore === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          `${localizeDigits(Math.round(summary.averageQuizScore), locale)}${percentSign}`
        ),
      icon: Award,
      tileClassName: 'bg-purple-gradient',
    },
    {
      key: 'lastActivity',
      label: t('students.detail.summaryCards.lastActivity'),
      value: formatRelativeTime(summary.lastActivityAt, locale),
      icon: Clock,
      // warning-500 → warning-600; no gradient token exists for this warmer tone.
      tileStyle: { background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ key, label, value, icon: Icon, tileClassName, tileStyle, progress }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-4 shadow-card"
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn ${
              tileClassName ?? ''
            }`}
            style={tileStyle}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption text-gray-600">{label}</span>
            <span className="text-xl font-bold text-navy-800">{value}</span>
            {progress && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={progress.colorClass}
                  style={{ width: `${progress.percent}%`, height: '100%' }}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
