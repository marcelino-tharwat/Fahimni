import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  CoursePaymentDTO,
  Paginated,
  PaymentsQuery,
  RevenueByChapterRow,
  RevenueByTeacherRow,
  RevenueSummary,
  SubscriptionPaymentDTO,
} from '@/features/admin/types/revenue';

function toParams(query: PaymentsQuery | { page?: number; limit?: number }): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  const q = query as PaymentsQuery;
  if (q.page != null) p.page = q.page;
  if (q.limit != null) p.limit = q.limit;
  if (q.q) p.q = q.q;
  if (q.status) p.status = q.status;
  if (q.teacherId) p.teacherId = q.teacherId;
  if (q.studentId) p.studentId = q.studentId;
  if (q.dateFrom) p.dateFrom = q.dateFrom;
  if (q.dateTo) p.dateTo = q.dateTo;
  return p;
}

export const adminRevenueApi = {
  getSummary: async (): Promise<RevenueSummary> => {
    const { data } = await apiClient.get<ApiResponse<RevenueSummary>>('/admin/revenue/summary');
    return data.data;
  },
  getByTeacher: async (query: { page?: number; limit?: number } = {}): Promise<Paginated<RevenueByTeacherRow>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<RevenueByTeacherRow>>>(
      '/admin/revenue/by-teacher',
      { params: toParams(query) },
    );
    return data.data;
  },
  getByChapter: async (query: { page?: number; limit?: number } = {}): Promise<Paginated<RevenueByChapterRow>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<RevenueByChapterRow>>>(
      '/admin/revenue/by-chapter',
      { params: toParams(query) },
    );
    return data.data;
  },
  listCoursePayments: async (query: PaymentsQuery): Promise<Paginated<CoursePaymentDTO>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<CoursePaymentDTO>>>(
      '/admin/payments/course',
      { params: toParams(query) },
    );
    return data.data;
  },
  getCoursePayment: async (paymentId: string): Promise<CoursePaymentDTO> => {
    const { data } = await apiClient.get<ApiResponse<CoursePaymentDTO>>(
      `/admin/payments/course/${paymentId}`,
    );
    return data.data;
  },
  listSubscriptionPayments: async (query: PaymentsQuery): Promise<Paginated<SubscriptionPaymentDTO>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<SubscriptionPaymentDTO>>>(
      '/admin/payments/subscriptions',
      { params: toParams(query) },
    );
    return data.data;
  },
  getSubscriptionPayment: async (paymentId: string): Promise<SubscriptionPaymentDTO> => {
    const { data } = await apiClient.get<ApiResponse<SubscriptionPaymentDTO>>(
      `/admin/payments/subscriptions/${paymentId}`,
    );
    return data.data;
  },
};
