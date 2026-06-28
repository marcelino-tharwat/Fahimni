import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils/cn';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
}: PaginationProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  const isPrevDisabled = isLoading || currentPage === 1;
  const isNextDisabled = isLoading || currentPage === totalPages;

  const buttonClass =
    'flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-600 transition-all hover:border-gray-400 hover:text-navy-800';

  return (
    <div className="flex items-center justify-between border-t border-gray-300 px-4 py-3">
      <p className="text-sm text-gray-600">
        {`${t('promoCodes.page')} ${currentPage.toLocaleString(locale)} ${t('promoCodes.of')} ${totalPages.toLocaleString(locale)}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isPrevDisabled}
          className={cn(
            buttonClass,
            isPrevDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
          )}
        >
          <ChevronRight size={15} />
          {t('promoCodes.previous')}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isNextDisabled}
          className={cn(
            buttonClass,
            isNextDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
          )}
        >
          {t('promoCodes.next')}
          <ChevronLeft size={15} />
        </button>
      </div>
    </div>
  );
}
