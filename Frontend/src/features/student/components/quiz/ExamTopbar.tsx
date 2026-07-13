import { useTranslation } from 'react-i18next';
import { GraduationCap, Clock } from 'lucide-react';

import { formatTimerDisplay } from '@/features/student/hooks/useQuizAttemptTimer';

interface ExamTopbarProps {
  timerSeconds: number;
  timerWarning: boolean;
  onEndExam: () => void;
  timerLabel?: string;
  disableEndExam?: boolean;
}

export function ExamTopbar({
  timerSeconds,
  timerWarning,
  onEndExam,
  timerLabel,
  disableEndExam = false,
}: ExamTopbarProps) {
  const { i18n, t } = useTranslation();

  return (
    <header className="relative sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-gray-300 bg-white px-3 sm:px-5">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-gradient">
          <GraduationCap size={16} className="text-white" />
        </div>
        <span className="hidden text-base font-bold text-navy-900 sm:inline">
          {i18n.language === 'ar' ? 'فهّمني' : 'Fahimni'}
        </span>
      </div>

      <div
        role="timer"
        aria-live="off"
        className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 ${
          timerWarning ? 'bg-danger-500 animate-pulse' : 'bg-navy-900'
        }`}
        style={timerWarning ? { boxShadow: '0 0 16px rgba(239,68,68,0.4)' } : undefined}
      >
        <Clock size={15} className="text-white" />
        <span
          className="text-base font-bold text-white"
          style={{ letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatTimerDisplay(timerSeconds >= 0 ? timerSeconds : 0, i18n.language)}
        </span>
      </div>

      {timerLabel ? (
        <p className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs font-medium text-navy-700">
          {timerLabel}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onEndExam}
        disabled={disableEndExam}
        className="h-9 shrink-0 rounded-btn border-2 border-danger-500 px-2.5 text-xs font-semibold text-danger-500 transition-all hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
      >
        {t('quiz:endExam')}
      </button>
    </header>
  );
}
