import { useTranslation } from 'react-i18next';
import { Users, BookOpen, Wallet } from 'lucide-react';
import { Badge, Card, StatCard } from '@/shared/components/ui';
import { mockTenant } from '@/shared/mocks/tenant';
import { mockAnalytics } from '@/shared/mocks/analytics';
import { formatEGP } from '@/shared/lib/utils/formatCurrency';
import type { SubscriptionStatus } from '@/shared/types';

const statusVariant: Record<SubscriptionStatus, 'success' | 'info' | 'danger' | 'warning'> = {
  active: 'success',
  trial: 'info',
  expired: 'danger',
  suspended: 'warning',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="font-cairo text-sm text-text-secondary">{label}</span>
      <span className="font-cairo text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function TenantDetailsPage() {
  const { t } = useTranslation();
  const status = mockTenant.subscriptionStatus;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{mockTenant.name}</h1>

      {/* Tenant info */}
      <Card padding="lg" className="flex flex-col gap-1">
        <InfoRow label={t('admin.tenantName')} value={mockTenant.name} />
        <InfoRow label={t('admin.link')} value={mockTenant.slug} />
        <InfoRow label={t('admin.teacher')} value={mockTenant.teacherName} />
        <InfoRow label={t('admin.subject')} value={mockTenant.subject} />
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="font-cairo text-sm text-text-secondary">{t('admin.status')}</span>
          <Badge variant={statusVariant[status]}>{t(`admin.${status}`)}</Badge>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title={t('admin.studentCount')} value={mockAnalytics.totalStudents} icon={Users} />
        <StatCard title={t('admin.chapterCount')} value={mockAnalytics.publishedChapters} icon={BookOpen} />
        <StatCard title={t('admin.revenue')} value={formatEGP(mockAnalytics.revenueThisMonth)} icon={Wallet} />
      </div>
    </div>
  );
}
