import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoCodesApi } from '@/features/admin/api/promoCodes';
import type { ListPromoCodesParams } from '@/shared/types';

export const PROMO_CODES_QUERY_KEY = ['admin', 'promo-codes'] as const;

/**
 * Paginated + filtered list of promo codes. `placeholderData: (prev) => prev`
 * keeps the previous page on screen while the next page loads, so pagination
 * doesn't flash an empty/loading table.
 */
export function usePromoCodes(params: ListPromoCodesParams) {
  return useQuery({
    queryKey: [...PROMO_CODES_QUERY_KEY, params],
    queryFn: () => promoCodesApi.list(params),
    placeholderData: (prev) => prev,
  });
}

/**
 * Generate a new promo code. On success, invalidate every promo-code query
 * (all list pages/filters share the key prefix) so the table refetches with
 * the new code included.
 */
export function useGeneratePromoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) => promoCodesApi.generate(chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMO_CODES_QUERY_KEY });
    },
  });
}
