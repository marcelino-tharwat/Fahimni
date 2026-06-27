import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import type { QuizQuestion } from '@/shared/types';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface ProgressAndNavigatorCardProps {
  questions: QuizQuestion[];
  answers: Record<string, string>;
  validationErrors: Set<string>;
  showValidationBanner: boolean;
  currentId: string | null;
}

export function ProgressAndNavigatorCard({
  questions,
  answers,
  validationErrors,
  showValidationBanner,
  currentId,
}: ProgressAndNavigatorCardProps) {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRtl = i18n.language === 'ar';

  const answeredCount = questions.filter((q) => {
    const val = answers[q.id];
    return val !== undefined && val !== '';
  }).length;

  const unansweredCount = questions.length - answeredCount;

  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      if (!scrollRef.current) return;
      const amount = direction === 'left' ? -80 : 80;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    },
    [],
  );

  const handleCircleClick = (id: string) => {
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const circleState = (q: QuizQuestion) => {
    const answered = answers[q.id] !== undefined && answers[q.id] !== '';
    const isCurrent = currentId === q.id;
    const isError = validationErrors.has(q.id);

    if (isError) return 'error';
    if (answered) return 'answered';
    if (isCurrent) return 'current';
    return 'unanswered';
  };

  return (
    <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-navy-800">
          {t('quiz:questionProgress', { current: toLocalNum(answeredCount), total: toLocalNum(questions.length) })}
        </span>
        <span className="text-caption text-gray-600">
          {t('quiz:answeredCount', { answered: toLocalNum(answeredCount) })}
        </span>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-300">
        <div
          className="h-full rounded-full bg-cyan-gradient transition-all duration-500"
          style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
        />
      </div>

      {showValidationBanner && unansweredCount > 0 && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <AlertCircle size={13} className="text-danger-500" />
          <span className="text-caption font-medium text-danger-500">
            {t('quiz:unansweredCount', { count: toLocalNum(unansweredCount) })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scroll(isRtl ? 'right' : 'left')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
          aria-label="scroll left"
        >
          <ChevronRight size={16} />
        </button>

        <div
          ref={scrollRef}
          className="flex flex-1 gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {questions.map((q, idx) => {
            const state = circleState(q);
            const numStr = toLocalNum(idx + 1);

            let bg = '';
            let border = '';
            let text = '';

            if (state === 'answered') {
              bg = 'bg-cyan-500';
              border = 'border-cyan-500';
              text = 'text-white';
            } else if (state === 'current') {
              bg = 'bg-white';
              border = 'border-cyan-500';
              text = 'text-cyan-500';
            } else if (state === 'error') {
              bg = 'bg-danger-50';
              border = 'border-danger-500';
              text = 'text-danger-500';
            } else {
              bg = 'bg-gray-200';
              border = 'border-gray-300';
              text = 'text-gray-600';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => handleCircleClick(q.id)}
                aria-label={t('quiz:goToQuestion', { num: numStr })}
                className={`relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-bold transition-all hover:scale-110 ${bg} ${border} ${text} border-2`}
              >
                {state === 'error' && (
                  <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-danger-500" />
                )}
                {numStr}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scroll(isRtl ? 'left' : 'right')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
          aria-label="scroll right"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}
