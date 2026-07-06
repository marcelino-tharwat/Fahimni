import { useTranslation } from 'react-i18next';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';
import type { ResultFilterKey } from '@/features/student/types/quizResults';

interface ResultFilterBarProps {
  active: ResultFilterKey;
  counts: Record<ResultFilterKey, number>;
  onChange: (key: ResultFilterKey) => void;
  // When correctness is hidden there is no right/wrong split to filter by.
  correctnessHidden?: boolean;
}

export function ResultFilterBar({
  active,
  counts,
  onChange,
  correctnessHidden,
}: ResultFilterBarProps) {
  const { t } = useTranslation();

  const pills: { key: ResultFilterKey; label: string }[] = [
    { key: 'all', label: t('quiz:results.filterAll') },
    ...(correctnessHidden
      ? []
      : [
          { key: 'correct' as const, label: t('quiz:results.filterCorrect') },
          { key: 'wrong' as const, label: t('quiz:results.filterWrong') },
        ]),
    ...(counts.pending > 0
      ? [{ key: 'pending' as const, label: t('quiz:results.filterPending') }]
      : []),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white p-3 shadow-card">
      <h2 className="text-lg font-bold text-navy-800">{t('quiz:results.reviewAnswers')}</h2>

      <div className="flex flex-wrap gap-2">
        {pills.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-badge px-3 py-1.5 text-small font-semibold transition-colors',
                isActive ? 'bg-cyan-gradient text-white' : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 text-caption font-semibold',
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                )}
              >
                {toLocalNum(counts[key])}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
