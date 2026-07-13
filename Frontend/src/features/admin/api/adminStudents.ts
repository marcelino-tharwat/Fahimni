import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminStudentDetail,
  AdminStudentsQuery,
  AdminStudentListItem,
  AdminStudentUpdatePayload,
  EnrollmentStatus,
  Paginated,
  StudentEnrollmentItem,
  StudentIdentity,
  StudentLearningSummary,
  StudentPayments,
} from '@/features/admin/types/students';

/** Admin Students Management endpoints (`apiClient.baseURL` already includes `/api`). */
export const adminStudentsApi = {
  list: async (query: AdminStudentsQuery): Promise<Paginated<AdminStudentListItem>> => {
    const params: Record<string, string | number> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.q) params.q = query.q;
    if (query.status) params.status = query.status;
    if (query.filter) params.filter = query.filter;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sort) params.sort = query.sort;
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminStudentListItem>>>(
      '/admin/students',
      { params },
    );
    return data.data;
  },

  getDetail: async (studentId: string): Promise<AdminStudentDetail> => {
    const { data } = await apiClient.get<ApiResponse<AdminStudentDetail>>(
      `/admin/students/${studentId}`,
    );
    return data.data;
  },

  getEnrollments: async (
    studentId: string,
    params: { page?: number; limit?: number; status?: EnrollmentStatus },
  ): Promise<Paginated<StudentEnrollmentItem>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<StudentEnrollmentItem>>>(
      `/admin/students/${studentId}/enrollments`,
      { params },
    );
    return data.data;
  },

  getPayments: async (studentId: string): Promise<StudentPayments> => {
    const { data } = await apiClient.get<ApiResponse<StudentPayments>>(
      `/admin/students/${studentId}/payments`,
    );
    return data.data;
  },

  getLearningSummary: async (studentId: string): Promise<StudentLearningSummary> => {
    const { data } = await apiClient.get<ApiResponse<StudentLearningSummary>>(
      `/admin/students/${studentId}/learning-summary`,
    );
    return data.data;
  },

  update: async (studentId: string, payload: AdminStudentUpdatePayload): Promise<StudentIdentity> => {
    const { data } = await apiClient.patch<ApiResponse<StudentIdentity>>(
      `/admin/students/${studentId}`,
      payload,
    );
    return data.data;
  },
};
