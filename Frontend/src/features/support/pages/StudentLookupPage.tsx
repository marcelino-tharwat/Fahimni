import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';
import { Card, EmptyState, Input } from '@/shared/components/ui';

export function StudentLookupPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('nav.studentLookup')}</h1>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-secondary start-3"
        />
        <Input
          className="ps-10"
          placeholder="ابحث بالاسم أو البريد الإلكتروني"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <Card padding="lg" className="flex items-center justify-center">
        <EmptyState icon={Users} title="ابحث عن طالب بالاسم أو البريد الإلكتروني" />
      </Card>
    </div>
  );
}
