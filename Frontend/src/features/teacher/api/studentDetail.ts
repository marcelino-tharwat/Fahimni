import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  TeacherStudentDetailResponse,
  TeacherStudentDetailQueryParams,
} from '@/features/teacher/types/studentDetail';

/**
 * Teacher single-student engagement detail endpoint (STORY-75).
 *
 * Backend route (mounted at `/api/dashboard`, see backend/src/app.ts):
 *   GET /dashboard/teacher/students/:studentId   -> { success, message, data }
 *
 * Teacher-only (OPERATION role). An unknown student, or one not enrolled in any
 * of the caller's chapters, returns 404 (intentionally, not 403) — the ApiError
 * propagates to the hook/UI. Cookie auth is handled by the axios instance
 * (`withCredentials: true`).
 */
export const teacherStudentDetailApi = {
  getStudentDetail: async (
    studentId: string,
    params?: TeacherStudentDetailQueryParams,
  ): Promise<TeacherStudentDetailResponse> => {
    const { data } = await apiClient.get<ApiResponse<TeacherStudentDetailResponse>>(
      `/dashboard/teacher/students/${studentId}`,
      { params: cleanParams(params) },
    );
    return data.data;
  },
};

/**
 * Drop keys the backend should not receive: `undefined` values and an empty
 * `chapterId` (the "all chapters" selection sends ''). Valid `0` values are
 * preserved (defensive — stripping them would be a latent bug if the contract
 * grows).
 */
function cleanParams(
  params?: TeacherStudentDetailQueryParams,
): TeacherStudentDetailQueryParams | undefined {
  if (!params) return undefined;

  const cleaned: TeacherStudentDetailQueryParams = {};

  if (params.chapterId !== undefined && params.chapterId !== '') {
    cleaned.chapterId = params.chapterId;
  }
  if (params.page !== undefined) cleaned.page = params.page;
  if (params.pageSize !== undefined) cleaned.pageSize = params.pageSize;

  return cleaned;
}
