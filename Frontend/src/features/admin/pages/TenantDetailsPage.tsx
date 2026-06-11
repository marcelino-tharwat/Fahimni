import { Users, BookOpen, Wallet } from 'lucide-react';
import { Badge, Card, StatCard } from '@/shared/components/ui';
import { mockTenant } from '@/shared/mocks/tenant';
import { mockAnalytics } from '@/shared/mocks/analytics';
import { formatEGP } from '@/shared/lib/utils/formatCurrency';
import type { SubscriptionStatus } from '@/shared/types';

const statusMeta: Record<SubscriptionStatus, { label: string; variant: 'success' | 'info' | 'danger' | 'warning' }> = {
  active: { label: 'نشط', variant: 'success' },
  trial: { label: 'تجريبي', variant: 'info' },
  expired: { label: 'منتهي', variant: 'danger' },
  suspended: { label: 'موقوف', variant: 'warning' },
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
  const status = statusMeta[mockTenant.subscriptionStatus];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{mockTenant.name}</h1>

      {/* Tenant info */}
      <Card padding="lg" className="flex flex-col gap-1">
        <InfoRow label="اسم الأكاديمية" value={mockTenant.name} />
        <InfoRow label="الرابط" value={mockTenant.slug} />
        <InfoRow label="المعلم" value={mockTenant.teacherName} />
        <InfoRow label="المادة" value={mockTenant.subject} />
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="font-cairo text-sm text-text-secondary">الحالة</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="عدد الطلاب" value={mockAnalytics.totalStudents} icon={Users} />
        <StatCard title="عدد الأبواب" value={mockAnalytics.publishedChapters} icon={BookOpen} />
        <StatCard title="الإيرادات" value={formatEGP(mockAnalytics.revenueThisMonth)} icon={Wallet} />
      </div>
    </div>
  );
}
