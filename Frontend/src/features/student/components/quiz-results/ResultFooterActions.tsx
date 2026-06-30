import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';

interface ResultFooterActionsProps {
  onDashboard: () => void;
}

export function ResultFooterActions({ onDashboard }: ResultFooterActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={onDashboard}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-gradient px-8 text-sm font-bold text-white shadow-glow transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[220px]"
      >
        <Home size={16} />
        {t('quiz:results.goToDashboard')}
      </button>
    </div>
  );
}
