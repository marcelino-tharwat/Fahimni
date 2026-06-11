import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/shared/components/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="٤٠٤ — الصفحة مش موجودة"
        action={{ label: t('nav.home'), onClick: () => navigate('/') }}
      />
    </div>
  );
}
