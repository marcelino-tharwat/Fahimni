import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminPlatformPromoCodesApi } from '@/features/admin/api/adminPlatformPromoCodes';
import type { CreatePromoInput, PromoListQuery } from '@/features/admin/types/platformPromoCodes';

const KEY = ['admin', 'platform-promo-codes'] as const;

export function useAdminPromoCodes(query: PromoListQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => adminPlatformPromoCodesApi.list(query),
    staleTime: 20_000,
  });
}

export function useAdminPromoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (body: CreatePromoInput) => adminPlatformPromoCodesApi.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; body: Partial<CreatePromoInput> }) =>
      adminPlatformPromoCodesApi.update(v.id, v.body),
    onSuccess: invalidate,
  });
  const changeStatus = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      adminPlatformPromoCodesApi.changeStatus(v.id, v.isActive),
    onSuccess: invalidate,
  });

  return { create, update, changeStatus };
}
