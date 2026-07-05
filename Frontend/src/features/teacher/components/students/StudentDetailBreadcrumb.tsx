import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StudentDetailBreadcrumbProps {
  /** Undefined while the detail is still loading. */
  studentName: string | undefined;
  onBackClick: () => void;
}

export function StudentDetailBreadcrumb({
  studentName,
  onBackClick,
}: StudentDetailBreadcrumbProps) {
  const { t, i18n } = useTranslation('teacher');
  const isRtl = i18n.language.startsWith('ar');

  return (
    <nav className="flex items-center gap-2 text-caption">
      <button
        type="button"
        onClick={onBackClick}
        className="font-medium text-cyan-500 transition-colors hover:text-cyan-600"
      >
        {t('students.detail.breadcrumb')}
      </button>
      {isRtl ? (
        <ChevronLeft className="h-3 w-3 text-gray-400" />
      ) : (
        <ChevronRight className="h-3 w-3 text-gray-400" />
      )}
      <span className="font-medium text-gray-600">{studentName ?? '...'}</span>
    </nav>
  );
}
