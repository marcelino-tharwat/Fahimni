import { useQuery } from '@tanstack/react-query';
import { adminRevenueApi } from '@/features/admin/api/adminRevenue';
import type { PaymentsQuery } from '@/features/admin/types/revenue';

const KEY = ['admin', 'revenue'] as const;

export function useRevenueSummary() {
  return useQuery({ queryKey: [...KEY, 'summary'], queryFn: adminRevenueApi.getSummary, staleTime: 30_000 });
}
export function useRevenueByTeacher(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...KEY, 'by-teacher', page, limit],
    queryFn: () => adminRevenueApi.getByTeacher({ page, limit }),
    staleTime: 30_000,
  });
}
export function useRevenueByChapter(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...KEY, 'by-chapter', page, limit],
    queryFn: () => adminRevenueApi.getByChapter({ page, limit }),
    staleTime: 30_000,
  });
}
export function useCoursePayments(query: PaymentsQuery) {
  return useQuery({
    queryKey: [...KEY, 'course-payments', query],
    queryFn: () => adminRevenueApi.listCoursePayments(query),
    staleTime: 30_000,
  });
}
export function useSubscriptionPayments(query: PaymentsQuery) {
  return useQuery({
    queryKey: [...KEY, 'subscription-payments', query],
    queryFn: () => adminRevenueApi.listSubscriptionPayments(query),
    staleTime: 30_000,
  });
}
