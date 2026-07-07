import { useQuery } from '@tanstack/react-query';
import { adminStatsApi } from '@/features/admin/api/adminStats';

export const ADMIN_STATS_QUERY_KEY = ['admin', 'stats'] as const;

/** Global platform metrics for the admin dashboard (overview only). */
export function useAdminStats() {
  return useQuery({
    queryKey: ADMIN_STATS_QUERY_KEY,
    queryFn: adminStatsApi.getStats,
  });
}
