import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  TutorAskResponse,
  TutorConversationSummary,
  TutorCursorPage,
  TutorMessage,
  TutorSendMessageResponse,
  TutorUsage,
} from '@/shared/types/aiTutor';

function unwrap<T>(payload: ApiResponse<T> & { success?: boolean }): T {
  return payload.data;
}

export const tutorApi = {
  /** POST /tutor/ask — stateless ask (preserved STORY-64 endpoint). */
  ask: async (question: string): Promise<TutorAskResponse> => {
    const { data } = await apiClient.post<ApiResponse<TutorAskResponse>>('/tutor/ask', {
      question,
    });
    return unwrap(data);
  },

  /** GET /tutor/usage-today */
  getUsageToday: async (): Promise<TutorUsage> => {
    const { data } = await apiClient.get<ApiResponse<TutorUsage>>('/tutor/usage-today');
    return unwrap(data);
  },

  createConversation: async (): Promise<TutorConversationSummary> => {
    const { data } = await apiClient.post<ApiResponse<TutorConversationSummary>>(
      '/tutor/conversations',
    );
    return unwrap(data);
  },

  listConversations: async (params?: {
    cursor?: string;
    limit?: number;
    archived?: boolean;
  }): Promise<TutorCursorPage<TutorConversationSummary>> => {
    const { data } = await apiClient.get<
      ApiResponse<TutorCursorPage<TutorConversationSummary>>
    >('/tutor/conversations', { params });
    return unwrap(data);
  },

  getConversation: async (conversationId: string): Promise<TutorConversationSummary> => {
    const { data } = await apiClient.get<ApiResponse<TutorConversationSummary>>(
      `/tutor/conversations/${conversationId}`,
    );
    return unwrap(data);
  },

  updateConversation: async (
    conversationId: string,
    patch: { title?: string; isArchived?: boolean },
  ): Promise<TutorConversationSummary> => {
    const { data } = await apiClient.patch<ApiResponse<TutorConversationSummary>>(
      `/tutor/conversations/${conversationId}`,
      patch,
    );
    return unwrap(data);
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/tutor/conversations/${conversationId}`);
  },

  listMessages: async (
    conversationId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<TutorCursorPage<TutorMessage>> => {
    const { data } = await apiClient.get<ApiResponse<TutorCursorPage<TutorMessage>>>(
      `/tutor/conversations/${conversationId}/messages`,
      { params },
    );
    return unwrap(data);
  },

  sendMessage: async (
    conversationId: string,
    body: { content: string; clientMessageId: string },
  ): Promise<TutorSendMessageResponse> => {
    const { data } = await apiClient.post<ApiResponse<TutorSendMessageResponse>>(
      `/tutor/conversations/${conversationId}/messages`,
      body,
    );
    return unwrap(data);
  },

  retryMessage: async (
    conversationId: string,
    messageId: string,
  ): Promise<TutorSendMessageResponse> => {
    const { data } = await apiClient.post<ApiResponse<TutorSendMessageResponse>>(
      `/tutor/conversations/${conversationId}/messages/${messageId}/retry`,
    );
    return unwrap(data);
  },
};

/** @deprecated Use tutorApi */
export const aiTutorApi = tutorApi;
