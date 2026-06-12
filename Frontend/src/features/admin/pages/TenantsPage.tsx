import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge, Table } from '@/shared/components/ui';
import { mockTenant } from '@/shared/mocks/tenant';
import { mockAnalytics } from '@/shared/mocks/analytics';
import type { SubscriptionStatus, Tenant } from '@/shared/types';

const statusVariant: Record<SubscriptionStatus, 'success' | 'info' | 'danger' | 'warning'> = {
  active: 'success',
  trial: 'info',
  expired: 'danger',
  suspended: 'warning',
};

const tenants: Tenant[] = [mockTenant];

export function TenantsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('admin.tenants')}</h1>

      <Table<Tenant>
        data={tenants}
        columns={[
          {
            key: 'name',
            header: t('admin.tenantName'),
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
          { key: 'teacher', header: t('admin.teacher'), render: (tenant) => tenant.teacherName },
          { key: 'subject', header: t('admin.subject'), render: (tenant) => tenant.subject },
          {
            key: 'status',
            header: t('admin.status'),
            render: (tenant) => (
              <Badge variant={statusVariant[tenant.subscriptionStatus]}>
                {t(`admin.${tenant.subscriptionStatus}`)}
              </Badge>
            ),
          },
          {
            key: 'students',
            header: t('admin.studentCount'),
            render: () => mockAnalytics.totalStudents,
          },
        ]}
      />
    </div>
  );
}
