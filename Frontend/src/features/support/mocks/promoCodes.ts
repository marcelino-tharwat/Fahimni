import type { PromoCode } from '@/shared/types';

export const mockPromoCodes: PromoCode[] = [
  {
    id: 'promo-1',
    tenantId: 'tenant-1',
    code: 'ABC12345',
    used: true,
    usedByStudentId: 'user-1',
    redeemedChapterId: 'chapter-1',
    generatedBy: 'user-3',
    createdAt: '2025-09-14T10:00:00.000Z',
  },
  {
    id: 'promo-2',
    tenantId: 'tenant-1',
    code: 'XYZ67890',
    used: false,
    generatedBy: 'user-3',
    createdAt: '2025-09-18T10:00:00.000Z',
  },
  {
    id: 'promo-3',
    tenantId: 'tenant-1',
    code: 'QWE11223',
    used: false,
    generatedBy: 'user-3',
    createdAt: '2025-09-22T10:00:00.000Z',
  },
];
