import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface SubmitSectionCardProps {
  answeredCount: number;
  totalCount: number;
  onOpenModal: () => void;
  disabled?: boolean;
}

export function SubmitSectionCard({
  answeredCount,
  totalCount,
  onOpenModal,
  disabled = false,
}: SubmitSectionCardProps) {
  const { t } = useTranslation();
  const allAnswered = answeredCount === totalCount;

  return (
    <div className="hidden rounded-card border border-gray-300 bg-white p-5 shadow-elevated sm:block">
      <div className="flex items-center justify-between gap-4">
        <div>
          {allAnswered ? (
            <span className="text-sm font-medium text-success-500">{t('quiz:allAnswered')}</span>
          ) : (
            <span className="text-sm text-gray-600">
              {t('quiz:answeredSummary', {
                answered: toLocalNum(answeredCount),
                total: toLocalNum(totalCount),
              })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          disabled={disabled}
          className="flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-btn bg-cyan-gradient px-8 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ boxShadow: '0 8px 20px -6px rgba(0,201,219,0.45)' }}
        >
          <Send size={16} />
          {t('quiz:submitQuiz')}
        </button>
      </div>
    </div>
  );
}
