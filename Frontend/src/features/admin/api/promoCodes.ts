import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@/shared/types';
import type {
  PromoCode,
  PromoCodeListItem,
  ListPromoCodesParams,
} from '@/shared/types';

/**
 * Admin promo-code API (SCRUM-425). Only the two ADMIN endpoints are needed
 * here — generate and list (validate/redeem are the student-side flow).
 *
 * `apiClient.baseURL` already includes `/api`, so paths are `/promo-codes`
 * (NOT `/api/promo-codes`). Responses use the shared `{ success, message, data }`
 * envelope, so we unwrap with `data.data` (axios `.data` → envelope `.data`).
 */
export const promoCodesApi = {
  // POST /promo-codes — empty body; server mints the 8-char code.
  generate: async (): Promise<PromoCode> => {
    const { data } = await apiClient.post<ApiResponse<PromoCode>>('/promo-codes');
    return data.data;
  },

  // GET /promo-codes?page&limit&isUsed — offset-paginated. Only defined params
  // are sent; `isUsed` is omitted entirely for the "all" filter (axios drops
  // undefined values, but we strip them explicitly to keep the query string clean).
  list: async (
    params: ListPromoCodesParams,
  ): Promise<PaginatedResponse<PromoCodeListItem>> => {
    const query = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined),
    );

    const { data } = await apiClient.get<
      ApiResponse<PaginatedResponse<PromoCodeListItem>>
    >('/promo-codes', { params: query });

    return data.data;
  },
};
