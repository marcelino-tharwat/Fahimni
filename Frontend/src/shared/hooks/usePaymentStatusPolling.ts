import { useEffect, useRef, useState, useCallback } from 'react';
import { paymentApi } from '@/features/student/api/payment';

export type PaymentStatus = 'idle' | 'confirming' | 'success' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Status codes where polling will never succeed — bail immediately.
 * 401: session expired, 403: order belongs to another user, 404: order gone.
 */
function isTerminalHttpCode(code: number | undefined): boolean {
  return code === 401 || code === 403 || code === 404;
}

export function usePaymentStatusPolling(
  orderId: string | null,
  onSuccess?: () => void,
  onFailed?: () => void,
) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onFailedRef = useRef(onFailed);

  onSuccessRef.current = onSuccess;
  onFailedRef.current = onFailed;

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  /**
   * Terminal bail out — stops polling, resets status to idle so the banner
   * disappears, and tells the consumer to clean up sessionStorage.
   */
  const bailOut = useCallback(() => {
    stopPolling();
    setStatus('idle');
    onFailedRef.current?.();
  }, [stopPolling]);

  /**
   * Thin wrapper around the API. Throws on network/HTTP errors so the caller
   * can distinguish terminal (401/403/404) from transient (5xx, network).
   */
  const checkStatusOnce = useCallback(async (id: string): Promise<string> => {
    const { data: res } = await paymentApi.getPaymentStatus(id);
    return res.data.status;
  }, []);

  const doPoll = useCallback(async (id: string) => {
    try {
      const paymentStatus = await checkStatusOnce(id);
      if (unmountedRef.current) return;

      if (paymentStatus === 'SUCCESS') {
        stopPolling();
        setStatus('success');
        onSuccessRef.current?.();
        return;
      }

      if (paymentStatus === 'FAILED') {
        stopPolling();
        setStatus('failed');
        onFailedRef.current?.();
        return;
      }
      // PENDING or transient error → keep polling (interval handles the next
      // tick; the 120s timeout in startPolling will eventually set 'timeout')
    } catch (err: unknown) {
      if (unmountedRef.current) return;
      const httpCode = (err as { statusCode?: number }).statusCode;

      if (isTerminalHttpCode(httpCode)) {
        // 401/403/404 → this order is dead to us, clean up immediately
        bailOut();
        return;
      }

      // Transient (network, 5xx, 4xx other than 401/403/404): do nothing.
      // The 120s overall timeout will eventually put us in 'timeout' state,
      // letting the user manually check status.  Do NOT silently kill the
      // polling loop — a brief backend blip during a real in-progress
      // payment shouldn't incorrectly abort the flow.
    }
  }, [checkStatusOnce, stopPolling, bailOut]);

  const startPolling = useCallback((id: string) => {
    setStatus('confirming');

    doPoll(id);
    pollTimerRef.current = setInterval(() => doPoll(id), POLL_INTERVAL_MS);
    timeoutTimerRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      stopPolling();
      setStatus('timeout');
    }, POLL_TIMEOUT_MS);
  }, [doPoll, stopPolling]);

  useEffect(() => {
    unmountedRef.current = false;

    if (orderId) {
      startPolling(orderId);
    } else {
      stopPolling();
      setStatus('idle');
    }

    return () => {
      unmountedRef.current = true;
      stopPolling();
    };
  }, [orderId, startPolling, stopPolling]);

  const checkStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const paymentStatus = await checkStatusOnce(orderId);
      if (unmountedRef.current) return;

      if (paymentStatus === 'SUCCESS') {
        stopPolling();
        setStatus('success');
        onSuccessRef.current?.();
        return;
      }
      if (paymentStatus === 'FAILED') {
        stopPolling();
        setStatus('failed');
        onFailedRef.current?.();
        return;
      }
    } catch (err: unknown) {
      if (unmountedRef.current) return;
      const httpCode = (err as { statusCode?: number }).statusCode;
      if (isTerminalHttpCode(httpCode)) {
        bailOut();
      }
    }
  }, [orderId, checkStatusOnce, stopPolling, bailOut]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
  }, [stopPolling]);

  return { status, checkStatus, reset, stopPolling };
}
