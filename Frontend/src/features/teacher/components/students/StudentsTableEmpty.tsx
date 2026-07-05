import { useTranslation } from 'react-i18next';
import { Users, Search } from 'lucide-react';

interface StudentsTableEmptyProps {
  variant: 'noStudents' | 'noResults';
  /** Required when variant === 'noResults'. */
  query?: string;
  /** Required when variant === 'noResults'. */
  onClearSearch?: () => void;
}

export function StudentsTableEmpty({ variant, query, onClearSearch }: StudentsTableEmptyProps) {
  const { t } = useTranslation('teacher');

  const isNoResults = variant === 'noResults';
  const Icon = isNoResults ? Search : Users;

  const title = isNoResults
    ? t('students.empty.noResults.title', { query: query ?? '' })
    : t('students.empty.noStudents.title');

  const description = isNoResults ? undefined : t('students.empty.noStudents.description');

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-h3 text-navy-800">{title}</h3>
      {description && <p className="max-w-md text-body text-gray-600">{description}</p>}
      {isNoResults && (
        <button
          type="button"
          onClick={onClearSearch}
          className="text-body font-semibold text-cyan-500 transition-colors hover:text-cyan-600"
        >
          {t('students.empty.noResults.action')}
        </button>
      )}
    </div>
  );
}
