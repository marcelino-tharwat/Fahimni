import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface StudentDetailErrorStateProps {
  onRetry: () => void;
}

export function StudentDetailErrorState({ onRetry }: StudentDetailErrorStateProps) {
  const { t } = useTranslation('teacher');

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50">
        <AlertCircle className="h-7 w-7 text-danger-500" />
      </div>
      <h3 className="text-h3 text-navy-800">{t('students.detail.error.title')}</h3>
      <p className="max-w-md text-body text-gray-600">{t('students.detail.error.description')}</p>
      <Button variant="primary" onClick={onRetry}>
        {t('students.detail.error.retry')}
      </Button>
    </div>
  );
}
