import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Table } from '@/shared/components/ui';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { mockPromoCodes } from '@/features/support/mocks/promoCodes';
import { mockStudents } from '@/shared/mocks/users';
import { formatDate } from '@/shared/lib/utils/formatDate';
import type { PromoCode } from '@/shared/types';

function studentName(studentId?: string): string {
  if (!studentId) return '—';
  return mockStudents.find((student) => student.id === studentId)?.name ?? '—';
}

export function PromoCodesPage() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('support.promoCodes')}</h1>
        <Button onClick={() => dispatch(addToast({ type: 'success', message: t('support.codeCreated') }))}>
          <Plus size={18} />
          {t('support.createCode')}
        </Button>
      </div>

      <Table<PromoCode>
        data={mockPromoCodes}
        columns={[
          {
            key: 'code',
            header: t('support.code'),
            render: (promo) => <span className="font-mono">{promo.code}</span>,
          },
          {
            key: 'status',
            header: t('support.status'),
            render: (promo) => (
              <Badge variant={promo.used ? 'default' : 'success'}>
                {promo.used ? t('support.used') : t('support.available')}
              </Badge>
            ),
          },
          {
            key: 'student',
            header: t('support.student'),
            render: (promo) => studentName(promo.usedByStudentId),
          },
          {
            key: 'date',
            header: t('support.date'),
            render: (promo) => formatDate(promo.createdAt),
          },
        ]}
      />
    </div>
  );
}
