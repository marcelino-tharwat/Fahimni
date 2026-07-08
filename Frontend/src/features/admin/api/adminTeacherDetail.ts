import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminTeacherDetail,
  Paginated,
  TeacherAiUsage,
  TeacherContent,
  TeacherEnrollmentItem,
  TeacherRevenue,
  TeacherStudentItem,
  TeacherSubscription,
  EnrollmentStatus,
} from '@/features/admin/types/teacherDetail';

/**
 * Admin Teacher Detail endpoints. `apiClient.baseURL` already includes `/api`,
 * so paths are `/admin/teachers/:id/*`. Every response uses the
 * `{ message, data }` envelope, so we unwrap with `data.data`.
 */
export const adminTeacherDetailApi = {
  getDetail: async (teacherId: string): Promise<AdminTeacherDetail> => {
    const { data } = await apiClient.get<ApiResponse<AdminTeacherDetail>>(
      `/admin/teachers/${teacherId}`,
    );
    return data.data;
  },

  getStudents: async (
    teacherId: string,
    params: { page?: number; limit?: number; q?: string },
  ): Promise<Paginated<TeacherStudentItem>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<TeacherStudentItem>>>(
      `/admin/teachers/${teacherId}/students`,
      { params },
    );
    return data.data;
  },

  getEnrollments: async (
    teacherId: string,
    params: { page?: number; limit?: number; status?: EnrollmentStatus },
  ): Promise<Paginated<TeacherEnrollmentItem>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<TeacherEnrollmentItem>>>(
      `/admin/teachers/${teacherId}/enrollments`,
      { params },
    );
    return data.data;
  },

  getContent: async (teacherId: string): Promise<TeacherContent> => {
    const { data } = await apiClient.get<ApiResponse<TeacherContent>>(
      `/admin/teachers/${teacherId}/content`,
    );
    return data.data;
  },

  getRevenue: async (teacherId: string): Promise<TeacherRevenue> => {
    const { data } = await apiClient.get<ApiResponse<TeacherRevenue>>(
      `/admin/teachers/${teacherId}/revenue`,
    );
    return data.data;
  },

  getSubscription: async (teacherId: string): Promise<TeacherSubscription> => {
    const { data } = await apiClient.get<ApiResponse<TeacherSubscription>>(
      `/admin/teachers/${teacherId}/subscription`,
    );
    return data.data;
  },

  getAiUsage: async (teacherId: string): Promise<TeacherAiUsage> => {
    const { data } = await apiClient.get<ApiResponse<TeacherAiUsage>>(
      `/admin/teachers/${teacherId}/ai-usage`,
    );
    return data.data;
  },
};
