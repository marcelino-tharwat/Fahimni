import { apiClient } from '@/shared/lib/api/client';

export const enrollmentApi = {
  getMyEnrollments: () => apiClient.get('/enrollments/me'),
  checkChapterAccess: (chapterId: string) =>
    apiClient.get(`/enrollments/access/${chapterId}`),
  enrollWithPromoCode: (chapterId: string, code: string) =>
    apiClient.post('/enrollments/promo-code', { chapterId, code }),
};
