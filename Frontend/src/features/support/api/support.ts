import { apiClient } from '@/shared/lib/api/client';

export const supportApi = {
  generatePromoCode: (tenantId: string) =>
    apiClient.post('/support/promo-codes', { tenantId }),
  getPromoCodes: (tenantId: string) =>
    apiClient.get('/support/promo-codes', { params: { tenantId } }),
  lookupStudent: (query: string) =>
    apiClient.get('/support/students', { params: { query } }),
};
