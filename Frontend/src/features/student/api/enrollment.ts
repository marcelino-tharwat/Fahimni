import { apiClient } from '@/shared/lib/api/client';
import type { FreeEnrollment, StudentApiResponse } from '@/features/student/types/student';

/**
 * Student enrollment API. Only the endpoints that actually exist on the backend
 * are kept here.
 *
 * Removed (pointed at routes that do not exist on the backend):
 *  - `enrollWithPromoCode` → was `POST /enrollments/promo-code`. Promo
 *    redemption now lives in `studentPromoApi.redeem` (POST /promo-codes/redeem).
 *  - `checkChapterAccess` → was `GET /enrollments/access/:chapterId`, no such route.
 */
export const enrollmentApi = {
  // GET /enrollments/my — STUDENT only (own enrollments). See enrollment.routes.ts.
  getMyEnrollments: () => apiClient.get('/enrollments/my'),
};

/**
 * POST /enrollments/free — STUDENT only. Directly enrolls the student in a free
 * chapter (price 0/null) with no promo code or payment. The studentId is taken
 * from the auth context server-side; the body is `{ chapterId }` only. Response
 * is wrapped in the backend `{ success, message, data }` envelope, so we unwrap
 * `data.data`. Errors surface via the shared apiClient interceptor as ApiError
 * (`{ statusCode, message, code }`) — see the CHAPTER_NOT_FREE / ALREADY_ENROLLED
 * codes in the backend contract.
 */
export const enrollFree = async (chapterId: string): Promise<FreeEnrollment> => {
  const { data } = await apiClient.post<StudentApiResponse<FreeEnrollment>>(
    '/enrollments/free',
    { chapterId },
  );
  return data.data;
};
