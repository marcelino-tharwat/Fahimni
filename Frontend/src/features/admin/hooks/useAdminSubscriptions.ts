import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSubscriptionsApi } from '@/features/admin/api/adminSubscriptions';
import type { ListQuery } from '@/features/admin/types/subscriptions';

const KEY = ['admin', 'subscriptions'] as const;

export function useAdminEntitlements(query: ListQuery) {
  return useQuery({
    queryKey: [...KEY, 'entitlements', query],
    queryFn: () => adminSubscriptionsApi.listEntitlements(query),
    staleTime: 30_000,
  });
}

export function useAdminSubscriptionsList(query: ListQuery) {
  return useQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: () => adminSubscriptionsApi.listSubscriptions(query),
    staleTime: 30_000,
  });
}

export function useAdminPayments(query: ListQuery) {
  return useQuery({
    queryKey: [...KEY, 'payments', query],
    queryFn: () => adminSubscriptionsApi.listPayments(query),
    staleTime: 30_000,
  });
}

export function useAdminSubscriptionRequests(query: ListQuery) {
  return useQuery({
    queryKey: [...KEY, 'requests', query],
    queryFn: () => adminSubscriptionsApi.listRequests(query),
    staleTime: 30_000,
  });
}

export function useAdminAiUsage(query: ListQuery) {
  return useQuery({
    queryKey: [...KEY, 'ai-usage', query],
    queryFn: () => adminSubscriptionsApi.listAiUsage(query),
    staleTime: 30_000,
  });
}

export function useReviewSubscriptionRequest() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [...KEY, 'requests'] });

  const approve = useMutation({
    mutationFn: (vars: { requestId: string; adminNotes?: string }) =>
      adminSubscriptionsApi.approveRequest(vars.requestId, { adminNotes: vars.adminNotes }),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (vars: { requestId: string; adminNotes: string }) =>
      adminSubscriptionsApi.rejectRequest(vars.requestId, { adminNotes: vars.adminNotes }),
    onSuccess: invalidate,
  });

  return { approve, reject };
}
