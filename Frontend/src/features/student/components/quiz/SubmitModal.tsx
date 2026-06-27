import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, Loader2, Send, X } from 'lucide-react';
import type { QuizQuestion } from '@/shared/types';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface SubmitModalProps {
  open: boolean;
  isSubmitting: boolean;
  allAnswered: boolean;
  totalCount: number;
  unansweredCount: number;
  unansweredIds: string[];
  questions: QuizQuestion[];
  onConfirm: () => void;
  onDismiss: () => void;
  onScrollToQuestion: (id: string) => void;
}

export function SubmitModal({
  open,
  isSubmitting,
  allAnswered,
  totalCount,
  unansweredCount,
  unansweredIds,
  questions,
  onConfirm,
  onDismiss,
  onScrollToQuestion,
}: SubmitModalProps) {
  const { i18n, t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || isSubmitting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isSubmitting, onDismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onDismiss}
        role="presentation"
      />

      <div
        ref={panelRef}
        dir={i18n.dir()}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full rounded-t-xl bg-white p-6 shadow-modal sm:mx-4 sm:max-w-[440px] sm:rounded-xl"
      >
        {!isSubmitting && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute start-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
            aria-label="close"
          >
            <X size={16} />
          </button>
        )}

        {isSubmitting ? <SubmittingVariant t={t} /> : allAnswered ? <AllAnsweredVariant t={t} totalCount={totalCount} onConfirm={onConfirm} onDismiss={onDismiss} /> : <PartialVariant t={t} totalCount={totalCount} unansweredCount={unansweredCount} unansweredIds={unansweredIds} questions={questions} onConfirm={onConfirm} onDismiss={onDismiss} onScrollToQuestion={onScrollToQuestion} />}
      </div>
    </div>
  );
}

function AllAnsweredVariant({
  t,
  totalCount,
  onConfirm,
  onDismiss,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  totalCount: number;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(0,201,219,0.1)', border: '2px solid rgba(0,201,219,0.3)' }}
        >
          <CheckCircle size={48} className="text-cyan-500" />
        </div>
        <h2 className="mt-3 text-h3 text-navy-800">{t('quiz:confirmSubmit')}</h2>
        <p className="mt-2 text-body text-gray-600">
          {t('quiz:confirmSubmitAllMsg', { total: toLocalNum(totalCount) })}
        </p>
        <p className="mt-1 text-caption text-gray-500">{t('quiz:noEditAfterSubmit')}</p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient text-sm font-bold text-white"
          style={{ boxShadow: '0 8px 20px -6px rgba(0,201,219,0.45)' }}
        >
          <Send size={16} />
          {t('quiz:submit')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-11 w-full rounded-btn text-sm font-medium text-gray-600 transition-colors hover:text-navy-800"
        >
          {t('quiz:reviewAnswers')}
        </button>
      </div>
    </>
  );
}

function PartialVariant({
  t,
  totalCount,
  unansweredCount,
  unansweredIds,
  questions,
  onConfirm,
  onDismiss,
  onScrollToQuestion,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  totalCount: number;
  unansweredCount: number;
  unansweredIds: string[];
  questions: QuizQuestion[];
  onConfirm: () => void;
  onDismiss: () => void;
  onScrollToQuestion: (id: string) => void;
}) {
  const unansweredLabels = unansweredIds
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean)
    .map((q) => {
      const idx = questions.indexOf(q!);
      return toLocalNum(idx + 1);
    });

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-50" style={{ border: '2px solid #FDE68A' }}>
          <AlertTriangle size={48} className="text-warning-500" />
        </div>
        <h2 className="mt-3 text-h3" style={{ color: '#B45309' }}>
          {t('quiz:unansweredWarning')}
        </h2>
        <p className="mt-2 text-body text-gray-600">
          {t('quiz:unansweredWarningMsg', {
            count: toLocalNum(unansweredCount),
            total: toLocalNum(totalCount),
          })}
        </p>
        <p className="mt-1.5 text-caption font-medium text-danger-500">
          {unansweredLabels.map((label, i) => (
            <span key={unansweredIds[i]}>
              {i > 0 && '، '}
              <button
                type="button"
                onClick={() => onScrollToQuestion(unansweredIds[i])}
                className="cursor-pointer underline hover:no-underline"
              >
                {label}
              </button>
            </span>
          ))}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient text-sm font-bold text-white"
          style={{ boxShadow: '0 8px 20px -6px rgba(0,201,219,0.45)' }}
        >
          {t('quiz:returnAndAnswer')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 w-full rounded-btn border-2 border-danger-500 text-sm font-semibold text-danger-500 transition-colors hover:bg-danger-50"
        >
          {t('quiz:submitAnyway')}
        </button>
      </div>
    </>
  );
}

function SubmittingVariant({
  t,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <Loader2 size={40} className="animate-spin text-cyan-500" />
      <div>
        <p className="text-base font-semibold text-navy-800">{t('quiz:submitting')}</p>
        <p className="mt-1 text-caption text-gray-500">{t('quiz:dontClose')}</p>
      </div>
    </div>
  );
}
