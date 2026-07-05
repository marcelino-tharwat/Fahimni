import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type {
  TeacherStudentsPageResponse,
  TeacherStudentsQueryParams,
} from '@/features/teacher/types/students';

/**
 * Teacher student-engagement list endpoint (STORY-74).
 *
 * Backend route (mounted at `/api/dashboard`, see backend/src/app.ts):
 *   GET /dashboard/teacher/students   -> { success, message, data }
 *
 * Teacher-only (OPERATION role); the teacher identity comes from the JWT, so no
 * id is sent from the client. Cookie auth is handled by the axios instance
 * (`withCredentials: true`).
 */
export const teacherStudentsApi = {
  getStudentsList: async (
    params?: TeacherStudentsQueryParams,
  ): Promise<TeacherStudentsPageResponse> => {
    const { data } = await apiClient.get<ApiResponse<TeacherStudentsPageResponse>>(
      '/dashboard/teacher/students',
      { params: cleanParams(params) },
    );
    return data.data;
  },
};

/**
 * Drop keys the backend should not receive: `undefined` values and an
 * empty/whitespace-only `search`. Valid `0`/`false` values are preserved
 * (defensive — none of the current params use them, but stripping them would be
 * a latent bug if the contract grows).
 */
function cleanParams(
  params?: TeacherStudentsQueryParams,
): TeacherStudentsQueryParams | undefined {
  if (!params) return undefined;

  const cleaned: TeacherStudentsQueryParams = {};

  if (params.page !== undefined) cleaned.page = params.page;
  if (params.limit !== undefined) cleaned.limit = params.limit;
  if (params.search !== undefined && params.search.trim() !== '') {
    cleaned.search = params.search;
  }
  if (params.sortBy !== undefined) cleaned.sortBy = params.sortBy;
  if (params.sortOrder !== undefined) cleaned.sortOrder = params.sortOrder;

  return cleaned;
}
