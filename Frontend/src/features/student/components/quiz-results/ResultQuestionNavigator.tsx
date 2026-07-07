import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';
import type { QuestionResult } from '@/features/student/types/quizResults';
import { resolveResultTone } from '@/features/student/lib/quizResultStats';

interface ResultQuestionNavigatorProps {
  results: QuestionResult[];
}

const TONE_BG: Record<string, string> = {
  correct: 'bg-success-500',
  incorrect: 'bg-danger-500',
  pending: 'bg-warning-500',
  neutral: 'bg-gray-400',
};

export function ResultQuestionNavigator({
  results,
}: ResultQuestionNavigatorProps) {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRtl = i18n.dir() === 'rtl';

  const scroll = useCallback(
    (forward: boolean) => {
      if (!scrollRef.current) return;

      const amount = forward ? 120 : -120;

      scrollRef.current.scrollBy({
        left: isRtl ? -amount : amount,
        behavior: 'smooth',
      });
    },
    [isRtl],
  );

  const handleClick = (id: string) => {
    document
      .getElementById(`qr-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex items-center gap-2 rounded-card border border-gray-300 bg-white p-3 shadow-card">
      {/* Previous */}
      <button
        type="button"
        onClick={() => scroll(false)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
        aria-label="Previous"
      >
        {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {results.map((r, idx) => (
          <button
            key={r.question.id}
            type="button"
            onClick={() => handleClick(r.question.id)}
            aria-label={t('quiz:goToQuestion', {
              num: toLocalNum(idx + 1),
            })}
            className={cn(
              'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-bold text-white transition-transform hover:scale-110',
              TONE_BG[resolveResultTone(r)] ?? 'bg-gray-500',
            )}
          >
            {toLocalNum(idx + 1)}
          </button>
        ))}
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => scroll(true)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
        aria-label="Next"
      >
        {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
}