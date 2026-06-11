import { useNavigate } from 'react-router-dom';
import { Badge, Table } from '@/shared/components/ui';
import { mockTenant } from '@/shared/mocks/tenant';
import { mockAnalytics } from '@/shared/mocks/analytics';
import type { SubscriptionStatus, Tenant } from '@/shared/types';

const statusMeta: Record<SubscriptionStatus, { label: string; variant: 'success' | 'info' | 'danger' | 'warning' }> = {
  active: { label: 'نشط', variant: 'success' },
  trial: { label: 'تجريبي', variant: 'info' },
  expired: { label: 'منتهي', variant: 'danger' },
  suspended: { label: 'موقوف', variant: 'warning' },
};

const tenants: Tenant[] = [mockTenant];

export function TenantsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">الأكاديميات</h1>

      <Table<Tenant>
        data={tenants}
        columns={[
          {
            key: 'name',
            header: 'اسم الأكاديمية',
            render: (tenant) => (
              <button
                type="button"
                onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                className="font-cairo font-medium text-accent hover:underline"
              >
                {tenant.name}
              </button>
            ),
          },
          { key: 'teacher', header: 'المعلم', render: (tenant) => tenant.teacherName },
          { key: 'subject', header: 'المادة', render: (tenant) => tenant.subject },
          {
            key: 'status',
            header: 'الحالة',
            render: (tenant) => (
              <Badge variant={statusMeta[tenant.subscriptionStatus].variant}>
                {statusMeta[tenant.subscriptionStatus].label}
              </Badge>
            ),
          },
          {
            key: 'students',
            header: 'عدد الطلاب',
            render: () => mockAnalytics.totalStudents,
          },
        ]}
      />
    </div>
  );
}
