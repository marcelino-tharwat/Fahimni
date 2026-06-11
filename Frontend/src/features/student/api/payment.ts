import { apiClient } from '@/shared/lib/api/client';

export const paymentApi = {
  createSession: (chapterId: string) =>
    apiClient.post('/payments/session', { chapterId }),
  verify: (transactionId: string) =>
    apiClient.post('/payments/verify', { transactionId }),
};
