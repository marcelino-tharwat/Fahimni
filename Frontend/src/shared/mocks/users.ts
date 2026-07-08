import type { User } from '@/shared/types';

export const mockStudents: User[] = [
  {
    id: 'user-1',
    fullName: 'يوسف أحمد',
    email: 'youssef@test.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    mobile: '+201001234567',
    createdAt: '2025-09-01T10:00:00.000Z',
  },
  {
    id: 'user-5',
    fullName: 'مريم علي',
    email: 'maryam@test.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    mobile: '+201005678901',
    createdAt: '2025-09-03T12:30:00.000Z',
  },
  {
    id: 'user-6',
    fullName: 'عمر حسن',
    email: 'omar@test.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    mobile: '+201009876543',
    createdAt: '2025-09-05T09:15:00.000Z',
  },
  {
    id: 'user-7',
    fullName: 'فاطمة محمود',
    email: 'fatma@test.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    mobile: '+201002223334',
    createdAt: '2025-09-10T14:45:00.000Z',
  },
  {
    id: 'user-8',
    fullName: 'محمد إبراهيم',
    email: 'mohamed@test.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    mobile: '+201007778889',
    createdAt: '2025-09-12T08:00:00.000Z',
  },
];
