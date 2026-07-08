import { apiClient, type ApiError } from '@/shared/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/shared/types/api';

export interface NotificationItem {
  id: string;
  type: 'NEW_LESSON' | 'NEW_QUIZ';
  resourceTitle: string;
  resourceType: string;
  resourceId: string;
  courseContextId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsListResponse {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}

const NOTIFICATIONS_KEY = ['notifications'] as const;

export const notificationsApi = {
  list: async (page = 1, limit = 20, isRead?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (isRead) params.set('isRead', isRead);
    const { data } = await apiClient.get<ApiResponse<NotificationsListResponse>>(
      `/notifications?${params.toString()}`,
    );
    return data.data;
  },

  getUnreadCount: async () => {
    const { data } = await apiClient.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count',
    );
    return data.data.count;
  },

  markAsRead: async (id: string) => {
    await apiClient.patch(`/notifications/${id}/read`);
  },
};

export function useNotifications(page = 1, limit = 20, isRead?: string) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', { page, limit, isRead }],
    queryFn: () => notificationsApi.list(page, limit, isRead),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
    onError: (_error: ApiError) => {
      // Silently fail — marking as read is non-critical
    },
  });
}
