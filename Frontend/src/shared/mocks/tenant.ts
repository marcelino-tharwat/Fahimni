import type { Tenant } from '@/shared/types';

export const mockTenant: Tenant = {
  id: 'tenant-1',
  name: 'أكاديمية الأستاذ أحمد للكيمياء',
  slug: 'mr-ahmed-chemistry',
  domain: 'ahmed.teacherplatform.com',
  teacherName: 'أ. أحمد محمد',
  subject: 'الكيمياء',
  bio: 'مدرس كيمياء بخبرة ١٥ سنة في تدريس المرحلة الثانوية. حاصل على ماجستير الكيمياء العضوية من جامعة القاهرة.',
  logoUrl: '/placeholder-logo.svg',
  teacherPhotoUrl: '/placeholder-teacher.svg',
  brandColors: { primary: '#1A103D', secondary: '#37306B', accent: '#00C9DB' },
  subscriptionStatus: 'active',
};
