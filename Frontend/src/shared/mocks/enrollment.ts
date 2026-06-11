import type { Enrollment } from '@/shared/types';

export const mockEnrollments: Enrollment[] = [
  {
    id: 'enroll-1',
    studentId: 'user-1',
    chapterId: 'chapter-1',
    tenantId: 'tenant-1',
    method: 'paymob',
    purchasedAt: '2025-09-15T11:00:00.000Z',
  },
  {
    id: 'enroll-2',
    studentId: 'user-1',
    chapterId: 'chapter-2',
    tenantId: 'tenant-1',
    method: 'paymob',
    purchasedAt: '2025-09-20T13:30:00.000Z',
  },
];
