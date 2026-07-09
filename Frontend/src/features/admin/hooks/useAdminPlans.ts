import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminPlansApi } from '@/features/admin/api/adminPlans';
import type { AdminPlanQuery, CreatePlanInput, UpdatePlanInput, StatusChangeInput, RecommendedChangeInput, ReorderInput } from '@/features/admin/types/plans';

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

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) => adminPlansApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: string; input: UpdatePlanInput }) =>
      adminPlansApi.update(planId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY }),
  });
}

export function useChangePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: string; input: StatusChangeInput }) =>
      adminPlansApi.changeStatus(planId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY }),
  });
}

export function useChangeRecommended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: string; input: RecommendedChangeInput }) =>
      adminPlansApi.changeRecommended(planId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY }),
  });
}

export function useReorderPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderInput) => adminPlansApi.reorder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY }),
  });
}
