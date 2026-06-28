import { useTranslation } from 'react-i18next';

export function AdminDashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('nav.dashboard')}</h1>
    </div>
  );
}
