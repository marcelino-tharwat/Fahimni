import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

interface ContentTreeErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export function ContentTreeErrorState({ onRetry, message }: ContentTreeErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertCircle size={40} className="text-danger-500" />
      <p className="font-cairo text-sm text-gray-500">
        {message ?? t('teacher:contentTree.error')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-lg border border-gray-200 px-4 py-2 font-cairo text-sm font-medium text-navy-700 transition-colors hover:bg-gray-100"
      >
        {t('teacher:contentTree.retry')}
      </button>
    </div>
  );
}
