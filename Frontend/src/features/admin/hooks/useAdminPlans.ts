import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminPlansApi } from '@/features/admin/api/adminPlans';
import type { AdminPlanQuery } from '@/features/admin/types/plans';

export const ADMIN_PLANS_QUERY_KEY = ['admin', 'plans'] as const;

export function useAdminPlans(query: AdminPlanQuery) {
  return useQuery({
    queryKey: [...ADMIN_PLANS_QUERY_KEY, query],
    queryFn: () => adminPlansApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPlanDetail(planId: string | undefined) {
  return useQuery({
    queryKey: [...ADMIN_PLANS_QUERY_KEY, 'detail', planId],
    queryFn: () => adminPlansApi.getDetail(planId!),
    enabled: !!planId,
  });
}
