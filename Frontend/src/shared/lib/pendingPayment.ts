/**
 * Session-scoped "pending payment" marker used by the student Paymob flow to
 * survive the redirect to/from the payment provider. It lives in
 * `sessionStorage` (cleared when the tab closes) and must be purged on logout so
 * a stale marker never leaks across accounts.
 *
 * Lives in `shared` (not `authSlice`) for two reasons: the auth contract forbids
 * any `sessionStorage` reference inside the slice (refresh tokens must never
 * touch web storage), and keeping it shared avoids an auth→student feature
 * dependency. The logout reducer calls `clearPendingPayment()` instead of
 * reaching into `sessionStorage` directly.
 */
export const PENDING_PAYMENT_KEY = 'pending_payment';

// try/catch guard mirrors auth/lib/token — tolerates non-browser (SSR/test)
// environments where `sessionStorage` is undefined.
const guard = (fn: () => void): void => {
  try {
    fn();
  } catch {
    /* no-op: sessionStorage unavailable */
  }
};

export const clearPendingPayment = (): void => {
  guard(() => sessionStorage.removeItem(PENDING_PAYMENT_KEY));
};
