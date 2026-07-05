import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { localizeDigits } from '@/features/teacher/lib/studentEngagementPresentation';

interface LessonsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageEntry = number | 'ellipsis';

/**
 * Compact page list. Up to 7 pages → show all. Otherwise always show the first
 * and last page, a window around the current page, and 'ellipsis' markers for
 * the gaps. (Mirrors StudentsPagination — a shared component is a later refactor.)
 */
function getPageRange(page: number, totalPages: number): PageEntry[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: PageEntry[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push('ellipsis');
    result.push(p);
    previous = p;
  }
  return result;
}

export function LessonsPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: LessonsPaginationProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const isRtl = i18n.language.startsWith('ar');

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const isFirst = page <= 1;
  const isLast = page >= totalPages;
  const entries = getPageRange(page, totalPages);

  const navButtonBase =
    'flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-300 p-4">
      <p className="text-[13px] text-gray-600">
        {t('students.detail.lessonsPagination.showing', {
          from: localizeDigits(from, locale),
          to: localizeDigits(to, locale),
          total: localizeDigits(total, locale),
        })}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          aria-label={t('students.pagination.previous')}
          className={`${navButtonBase} ${
            isFirst ? 'cursor-not-allowed text-gray-300' : 'text-navy-800 hover:bg-gray-100'
          }`}
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {entries.map((entry, index) =>
          entry === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={`${navButtonBase} ${
                entry === page
                  ? 'bg-cyan-500 font-semibold text-white'
                  : 'text-navy-800 hover:bg-gray-100'
              }`}
            >
              {localizeDigits(entry, locale)}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          aria-label={t('students.pagination.next')}
          className={`${navButtonBase} ${
            isLast ? 'cursor-not-allowed text-gray-300' : 'text-navy-800 hover:bg-gray-100'
          }`}
        >
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
