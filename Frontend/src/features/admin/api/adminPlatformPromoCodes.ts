import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  CreatePromoInput,
  Paginated,
  PlatformPromoCode,
  PromoListQuery,
} from '@/features/admin/types/platformPromoCodes';

function toParams(q: PromoListQuery): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {};
  if (q.page != null) p.page = q.page;
  if (q.limit != null) p.limit = q.limit;
  if (q.q) p.q = q.q;
  if (q.scope) p.scope = q.scope;
  if (q.isActive != null) p.isActive = q.isActive;
  return p;
}

export const adminPlatformPromoCodesApi = {
  list: async (query: PromoListQuery): Promise<Paginated<PlatformPromoCode>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<PlatformPromoCode>>>(
      '/admin/promo-codes',
      { params: toParams(query) },
    );
    return data.data;
  },
  get: async (promoId: string): Promise<PlatformPromoCode> => {
    const { data } = await apiClient.get<ApiResponse<PlatformPromoCode>>(`/admin/promo-codes/${promoId}`);
    return data.data;
  },
  create: async (body: CreatePromoInput): Promise<PlatformPromoCode> => {
    const { data } = await apiClient.post<ApiResponse<PlatformPromoCode>>('/admin/promo-codes', body);
    return data.data;
  },
  update: async (promoId: string, body: Partial<CreatePromoInput>): Promise<PlatformPromoCode> => {
    const { data } = await apiClient.patch<ApiResponse<PlatformPromoCode>>(`/admin/promo-codes/${promoId}`, body);
    return data.data;
  },
  changeStatus: async (promoId: string, isActive: boolean): Promise<PlatformPromoCode> => {
    const { data } = await apiClient.patch<ApiResponse<PlatformPromoCode>>(
      `/admin/promo-codes/${promoId}/status`,
      { isActive },
    );
    return data.data;
  },
};
