import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminTeacherRequestDetail,
  AdminTeacherRequestListItem,
  ApproveResponse,
  Paginated,
  SignedUrlResponse,
  TeacherRequestsQuery,
} from '@/features/admin/types/teacherRequests';

/** Admin Teacher Registration Requests endpoints (`apiClient.baseURL` includes `/api`). */
export const adminTeacherRequestsApi = {
  list: async (query: TeacherRequestsQuery): Promise<Paginated<AdminTeacherRequestListItem>> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.status) params.status = query.status;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sort) params.sort = query.sort;
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminTeacherRequestListItem>>>(
      '/admin/teacher-requests',
      { params },
    );
    return data.data;
  },

  getDetail: async (requestId: string): Promise<AdminTeacherRequestDetail> => {
    const { data } = await apiClient.get<ApiResponse<AdminTeacherRequestDetail>>(
      `/admin/teacher-requests/${requestId}`,
    );
    return data.data;
  },

  getDocumentSignedUrl: async (requestId: string, documentIndex: number): Promise<SignedUrlResponse> => {
    const { data } = await apiClient.get<ApiResponse<SignedUrlResponse>>(
      `/admin/teacher-requests/${requestId}/documents/${documentIndex}/signed-url`,
    );
    return data.data;
  },

  approve: async (
    requestId: string,
    body: { adminNotes?: string; createAccount: boolean },
  ): Promise<ApproveResponse> => {
    const { data } = await apiClient.patch<ApiResponse<ApproveResponse>>(
      `/admin/teacher-requests/${requestId}/approve`,
      body,
    );
    return data.data;
  },

  reject: async (
    requestId: string,
    body: { adminNotes: string; rejectionMode: 'EDIT_ALLOWED' | 'FINAL_REJECTION' },
  ): Promise<{ request: AdminTeacherRequestListItem; rejectionMode: string | null }> => {
    const { data } = await apiClient.patch<ApiResponse<{ request: AdminTeacherRequestListItem; rejectionMode: string | null }>>(
      `/admin/teacher-requests/${requestId}/reject`,
      body,
    );
    return data.data;
  },
};
