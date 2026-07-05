import { useTranslation } from 'react-i18next';
import { Badge, Skeleton } from '@/shared/components/ui';
import { localizeDigits } from '@/features/teacher/lib/studentEngagementPresentation';

interface StudentsPageHeaderProps {
  /** Undefined while the list is still loading. */
  totalStudents: number | undefined;
}

export function StudentsPageHeader({ totalStudents }: StudentsPageHeaderProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col">
        <h1 className="text-h1 text-navy-900">{t('students.pageTitle')}</h1>
        <p className="mt-1 text-body text-gray-600">{t('students.pageSubtitle')}</p>
      </div>

      {totalStudents === undefined ? (
        <Skeleton className="h-6 w-24 rounded-badge" />
      ) : (
        <Badge variant="cyan">
          {t('students.enrolledBadge', { count: localizeDigits(totalStudents, locale) })}
        </Badge>
      )}
    </div>
  );
}
