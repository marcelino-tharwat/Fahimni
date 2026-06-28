import { apiClient } from '@/shared/lib/api/client';

export const supportApi = {
  lookupStudent: (query: string) =>
    apiClient.get('/support/students', { params: { query } }),
};
