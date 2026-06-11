import { Plus } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cairo text-2xl font-bold text-text-primary">أكواد الخصم</h1>
        <Button onClick={() => dispatch(addToast({ type: 'success', message: 'تم إنشاء كود خصم جديد' }))}>
          <Plus size={18} />
          إنشاء كود جديد
        </Button>
      </div>

      <Table<PromoCode>
        data={mockPromoCodes}
        columns={[
          {
            key: 'code',
            header: 'الكود',
            render: (promo) => <span className="font-mono">{promo.code}</span>,
          },
          {
            key: 'status',
            header: 'الحالة',
            render: (promo) => (
              <Badge variant={promo.used ? 'default' : 'success'}>
                {promo.used ? 'مستخدم' : 'متاح'}
              </Badge>
            ),
          },
          {
            key: 'student',
            header: 'الطالب',
            render: (promo) => studentName(promo.usedByStudentId),
          },
          {
            key: 'date',
            header: 'التاريخ',
            render: (promo) => formatDate(promo.createdAt),
          },
        ]}
      />
    </div>
  );
}
