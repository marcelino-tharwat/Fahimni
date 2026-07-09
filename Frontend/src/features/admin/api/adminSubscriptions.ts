import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminPaymentDTO,
  AdminSubscriptionDetail,
  AdminSubscriptionListItem,
  AdminSubscriptionRequestItem,
  AiUsageResponse,
  ListQuery,
  Paginated,
  TeacherEntitlementRow,
} from '@/features/admin/types/subscriptions';

/** Admin Subscriptions Review endpoints (`apiClient.baseURL` already includes `/api`). */
function toParams(query: ListQuery): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (query.page != null) p.page = query.page;
  if (query.limit != null) p.limit = query.limit;
  if (query.q) p.q = query.q;
  if (query.status) p.status = query.status;
  if (query.planCode) p.planCode = query.planCode;
  if (query.entitlementSource) p.entitlementSource = query.entitlementSource;
  if (query.usageType) p.usageType = query.usageType;
  return p;
}

export const adminSubscriptionsApi = {
  listEntitlements: async (query: ListQuery): Promise<Paginated<TeacherEntitlementRow>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<TeacherEntitlementRow>>>(
      '/admin/teacher-entitlements',
      { params: toParams(query) },
    );
    return data.data;
  },

  listSubscriptions: async (query: ListQuery): Promise<Paginated<AdminSubscriptionListItem>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminSubscriptionListItem>>>(
      '/admin/teacher-subscriptions',
      { params: toParams(query) },
    );
    return data.data;
  },

  getSubscription: async (subscriptionId: string): Promise<AdminSubscriptionDetail> => {
    const { data } = await apiClient.get<ApiResponse<AdminSubscriptionDetail>>(
      `/admin/teacher-subscriptions/${subscriptionId}`,
    );
    return data.data;
  },

  listPayments: async (query: ListQuery): Promise<Paginated<AdminPaymentDTO>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminPaymentDTO>>>(
      '/admin/teacher-subscription-payments',
      { params: toParams(query) },
    );
    return data.data;
  },

  getPayment: async (paymentId: string): Promise<AdminPaymentDTO> => {
    const { data } = await apiClient.get<ApiResponse<AdminPaymentDTO>>(
      `/admin/teacher-subscription-payments/${paymentId}`,
    );
    return data.data;
  },

  listRequests: async (query: ListQuery): Promise<Paginated<AdminSubscriptionRequestItem>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminSubscriptionRequestItem>>>(
      '/admin/teacher-subscription-requests',
      { params: toParams(query) },
    );
    return data.data;
  },

  approveRequest: async (
    requestId: string,
    body: { adminNotes?: string },
  ): Promise<{ request: AdminSubscriptionRequestItem; activation: string }> => {
    const { data } = await apiClient.patch<
      ApiResponse<{ request: AdminSubscriptionRequestItem; activation: string }>
    >(`/admin/teacher-subscription-requests/${requestId}/approve`, body);
    return data.data;
  },

  rejectRequest: async (
    requestId: string,
    body: { adminNotes: string },
  ): Promise<{ request: AdminSubscriptionRequestItem }> => {
    const { data } = await apiClient.patch<ApiResponse<{ request: AdminSubscriptionRequestItem }>>(
      `/admin/teacher-subscription-requests/${requestId}/reject`,
      body,
    );
    return data.data;
  },

  listAiUsage: async (query: ListQuery): Promise<AiUsageResponse> => {
    const { data } = await apiClient.get<ApiResponse<AiUsageResponse>>('/admin/ai-usage', {
      params: toParams(query),
    });
    return data.data;
  },
};
