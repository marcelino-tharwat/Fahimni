import { apiClient } from '@/shared/lib/api/client';

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
