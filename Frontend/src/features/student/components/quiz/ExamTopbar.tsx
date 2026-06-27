import { useTranslation } from 'react-i18next';
import { GraduationCap, Clock } from 'lucide-react';

interface ExamTopbarProps {
  timerSeconds: number;
  timerWarning: boolean;
  onEndExam: () => void;
}

function formatTime(i18n: { language: string }, seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const raw = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (i18n.language === 'ar') {
    const arabicIndic: Record<string, string> = {
      '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
      '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
    };
    return raw.split('').map((c) => arabicIndic[c] ?? c).join('');
  }
  return raw;
}

export function ExamTopbar({ timerSeconds, timerWarning, onEndExam }: ExamTopbarProps) {
  const { i18n, t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-300 bg-white px-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-gradient">
          <GraduationCap size={16} className="text-white" />
        </div>
        <span className="text-base font-bold text-navy-900">
          {i18n.language === 'ar' ? 'فهّمني' : 'Fahimni'}
        </span>
      </div>

      <div
        role="timer"
        aria-live="off"
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${
          timerWarning ? 'bg-danger-500 animate-pulse' : 'bg-navy-900'
        }`}
        style={timerWarning ? { boxShadow: '0 0 16px rgba(239,68,68,0.4)' } : undefined}
      >
        <Clock size={15} className="text-white" />
        <span
          className="text-base font-bold text-white"
          style={{ letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatTime(i18n, timerSeconds >= 0 ? timerSeconds : 0)}
        </span>
      </div>

      <button
        type="button"
        onClick={onEndExam}
        className="h-9 rounded-btn border-2 border-danger-500 px-4 text-sm font-semibold text-danger-500 transition-all hover:bg-danger-50"
      >
        {t('quiz:endExam')}
      </button>
    </header>
  );
}
