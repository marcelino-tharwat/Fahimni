import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse, PromoValidationResult, RedeemResult } from '@/shared/types';

/**
 * Student-side promo-code API (SCRUM-425). The shared apiClient's baseURL
 * already includes `/api`, so paths here start at `/promo-codes`.
 *
 * Both endpoints wrap their payload in the backend `{ success, message, data }`
 * envelope (the FE `ApiResponse<T>` models the `{ data, message }` we read), so
 * each call unwraps `response.data.data` to return the bare result.
 *
 * See docs/promo-code-api-report.md §2.3 / §2.4 for the full contract.
 */
export const studentPromoApi = {
  /**
   * POST /promo-codes/:code/validate — STUDENT only. Pre-redeem check.
   *
   * ⚠️ ALWAYS resolves with HTTP 200 + success:true even for an invalid code —
   * inspect the returned `valid`/`reason`, NOT the HTTP status. The `:code`
   * path param must be 8 uppercase alphanumerics, so the code is trimmed +
   * upper-cased here to mirror the server and avoid a 400 on casing/whitespace.
   */
  validate: async (code: string, chapterId?: string): Promise<PromoValidationResult> => {
    const normalized = code.trim().toUpperCase();
    const params = chapterId ? { chapterId } : undefined;
    const { data } = await apiClient.post<ApiResponse<PromoValidationResult>>(
      `/promo-codes/${encodeURIComponent(normalized)}/validate`,
      undefined,
      { params },
    );
    return data.data;
  },

  /**
   * POST /promo-codes/redeem — STUDENT only. Canonical redeem.
   *
   * Body is `{ code, chapterId }` ONLY — the backend DTO is `.strict()` and
   * rejects any extra field. `chapterId` must be a UUID; the studentId is taken
   * from the auth context server-side, never the body. Returns 201 with the
   * created enrollment + the consumed promo code.
   */
  redeem: async (code: string, chapterId: string): Promise<RedeemResult> => {
    const { data } = await apiClient.post<ApiResponse<RedeemResult>>(
      '/promo-codes/redeem',
      { code: code.trim().toUpperCase(), chapterId },
    );
    return data.data;
  },
};
