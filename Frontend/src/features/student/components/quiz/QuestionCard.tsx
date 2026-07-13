import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import type { QuizQuestion } from '@/shared/types';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';

interface QuestionCardProps {
  question: QuizQuestion;
  index: number;
  answer: string;
  onAnswer: (id: string, value: string) => void;
  hasError: boolean;
  isPulsing: boolean;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
  hasError,
  isPulsing,
  disabled = false,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const answered = answer !== undefined && answer !== '';

  const typeLabel = (() => {
    switch (question.type) {
      case 'mcq': return t('quiz:type.mcq');
      case 'tf': return t('quiz:type.tf');
      case 'essay': return t('quiz:type.essay');
      case 'fill': return t('quiz:type.fill');
    }
  })();

  const numStr = toLocalNum(index + 1);

  const borderClass = hasError
    ? 'border-danger-500'
    : 'border-gray-300';

  return (
    <div
      id={`q-${question.id}`}
      data-qid={question.id}
      className={cn(
        'rounded-card border-2 bg-white p-6 shadow-card transition-all duration-300',
        borderClass,
        isPulsing && 'animate-pulse',
        disabled && 'pointer-events-none opacity-60',
      )}
      style={hasError ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.12)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            answered ? 'bg-cyan-500' : hasError ? 'bg-danger-500' : 'bg-navy-900',
          )}
        >
          {answered ? (
            <CheckCircle size={15} className="text-success-500" />
          ) : (
            numStr
          )}
        </div>

        <div className="flex gap-2">
          <span className="rounded-badge border border-gray-300 bg-gray-200 px-2 py-0.5 text-caption font-semibold text-gray-600">
            {toLocalNum(question.points)} {t('common:points', { defaultValue: 'نقطة' })}
          </span>
          <span className="rounded-badge border border-gray-300 bg-gray-200 px-2 py-0.5 text-caption font-semibold text-gray-600">
            {typeLabel}
          </span>
        </div>
      </div>

      <p className="mt-4 text-base leading-relaxed text-navy-800">{question.text}</p>

      {question.type === 'mcq' && question.options && (
        <div className="mt-4 flex flex-col gap-2.5">
          {question.options.map((opt) => {
            const selected = answer === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAnswer(question.id, opt.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md border-2 p-3.5 transition-all',
                  selected
                    ? 'border-cyan-500 bg-cyan-50'
                    : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-100',
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                    selected ? 'border-cyan-500' : 'border-gray-400',
                  )}
                >
                  {selected && <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />}
                </div>
                <span
                  className={cn(
                    'text-sm font-bold shrink-0',
                    selected ? 'text-cyan-700' : 'text-gray-500',
                  )}
                >
                  {opt.label}
                </span>
                <span
                  className={cn(
                    'text-sm text-navy-800',
                    selected && 'font-semibold',
                  )}
                >
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'tf' && (
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { value: 'true', label: t('common:true', { defaultValue: 'صح' }) },
            { value: 'false', label: t('common:false', { defaultValue: 'خطأ' }) },
          ].map((opt) => {
            const selected = answer === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onAnswer(question.id, opt.value)}
                className={cn(
                  'flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 text-sm font-semibold transition-all',
                  selected
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                    : 'border-gray-300 bg-white text-gray-600',
                )}
                style={{ height: '52px' }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'essay' && (
        <div className="mt-4">
          <textarea
            className="w-full min-h-[150px] resize-y rounded-input border border-gray-300 bg-white p-3 text-sm text-navy-800 transition-all placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            placeholder={t('quiz:writeAnswerHere')}
            maxLength={question.maxLength ?? 2000}
            value={answer ?? ''}
            onChange={(e) => onAnswer(question.id, e.target.value)}
          />
          <div className="mt-1 text-end text-caption">
            {(() => {
              const current = (answer ?? '').length;
              const max = question.maxLength ?? 2000;
              const pct = current / max;
              const colorClass = pct >= 1 ? 'text-danger-500' : pct > 0.9 ? 'text-warning-500' : 'text-gray-600';
              return <span className={colorClass}>{toLocalNum(current)} / {toLocalNum(max)}</span>;
            })()}
          </div>
        </div>
      )}

      {question.type === 'fill' && (
        <div className="mt-4">
          <input
            type="text"
            className="h-12 w-[220px] rounded-input border border-gray-300 bg-white px-4 text-sm text-navy-800 transition-all placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            placeholder={question.placeholder ?? t('quiz:writeAnswer')}
            value={answer ?? ''}
            onChange={(e) => onAnswer(question.id, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
