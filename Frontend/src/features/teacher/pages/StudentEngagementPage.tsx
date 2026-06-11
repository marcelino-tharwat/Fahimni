import { useTranslation } from 'react-i18next';
import { Progress, Table } from '@/shared/components/ui';
import { mockStudents } from '@/shared/mocks/users';
import { mockEnrollments } from '@/shared/mocks/enrollment';
import { formatDate } from '@/shared/lib/utils/formatDate';
import type { User } from '@/shared/types';

// Deterministic mock engagement progress per student.
const progressByStudent: Record<string, number> = {
  'user-1': 65,
  'user-5': 40,
  'user-6': 80,
  'user-7': 25,
  'user-8': 55,
};

function enrollmentCount(studentId: string): number {
  return mockEnrollments.filter((enrollment) => enrollment.studentId === studentId).length;
}

export function StudentEngagementPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('nav.students')}</h1>

      <Table<User>
        data={mockStudents}
        columns={[
          { key: 'name', header: 'الاسم', render: (student) => student.name },
          {
            key: 'chapters',
            header: 'الأبواب المشتركة',
            render: (student) => enrollmentCount(student.id),
          },
          {
            key: 'lastActivity',
            header: 'آخر نشاط',
            render: (student) => formatDate(student.createdAt),
          },
          {
            key: 'progress',
            header: 'التقدم',
            render: (student) => (
              <div className="min-w-[120px]">
                <Progress value={progressByStudent[student.id] ?? 0} size="sm" showLabel />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
