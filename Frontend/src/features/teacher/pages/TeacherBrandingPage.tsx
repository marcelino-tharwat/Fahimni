import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, UserRound } from 'lucide-react';
import { Button, Card, Input } from '@/shared/components/ui';
import { mockTenant } from '@/shared/mocks/tenant';

function UploadPlaceholder({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-background p-8 text-center">
      <div className="text-text-secondary">{icon}</div>
      <span className="font-cairo text-sm text-text-secondary">{label}</span>
    </div>
  );
}

export function TeacherBrandingPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('teacher:branding.title')}
      </h1>

      <Card padding="lg" className="flex flex-col gap-6">
        <Input label="اسم الأكاديمية" defaultValue={mockTenant.name} />

        <div className="flex flex-col gap-2">
          <span className="font-cairo text-sm font-medium text-text-primary">
            {t('teacher:branding.logo')}
          </span>
          <UploadPlaceholder label={t('teacher:branding.logo')} icon={<ImagePlus size={32} />} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-cairo text-sm font-medium text-text-primary">
            {t('teacher:branding.colors')}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Primary" defaultValue={mockTenant.brandColors.primary} />
            <Input label="Secondary" defaultValue={mockTenant.brandColors.secondary} />
            <Input label="Accent" defaultValue={mockTenant.brandColors.accent} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-cairo text-sm font-medium text-text-primary">
            {t('teacher:branding.teacherPhoto')}
          </span>
          <UploadPlaceholder
            label={t('teacher:branding.teacherPhoto')}
            icon={<UserRound size={32} />}
          />
        </div>

        <Button className="self-start">{t('actions.save')}</Button>
      </Card>
    </div>
  );
}
