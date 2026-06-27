import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface MobileStickySubmitBarProps {
  answeredCount: number;
  totalCount: number;
  onOpenModal: () => void;
}

export function MobileStickySubmitBar({ answeredCount, totalCount, onOpenModal }: MobileStickySubmitBarProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-300 bg-white px-4 py-3 shadow-elevated sm:hidden">
      <p className="mb-2 text-center text-caption text-gray-600">
        {t('quiz:answeredSummary', {
          answered: toLocalNum(answeredCount),
          total: toLocalNum(totalCount),
        })}
      </p>
      <button
        type="button"
        onClick={onOpenModal}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient text-sm font-bold text-white"
        style={{ boxShadow: '0 8px 20px -6px rgba(0,201,219,0.45)' }}
      >
        <Send size={16} />
        {t('quiz:submitQuiz')}
      </button>
    </div>
  );
}
