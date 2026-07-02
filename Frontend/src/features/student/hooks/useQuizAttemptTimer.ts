import { useCallback, useEffect, useRef, useState } from 'react';

export interface QuizAttemptTimerInput {
  expiresAt: string | null;
  serverTime: string | null;
  enabled: boolean;
}

export function computeRemainingSeconds(
  expiresAt: string,
  serverOffsetMs: number,
): number {
  const deadline = Date.parse(expiresAt);
  const now = Date.now() + serverOffsetMs;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

/**
 * Server-authoritative countdown derived from `expiresAt` and `serverTime`.
 * Re-syncs on visibility/focus; does not drift via naive decrement.
 */
export function deriveTimerExpired(
  timerReady: boolean,
  enabled: boolean,
  expiresAt: string | null,
  remainingSeconds: number,
): boolean {
  return timerReady && enabled && expiresAt != null && remainingSeconds === 0;
}

export function useQuizAttemptTimer({
  expiresAt,
  serverTime,
  enabled,
}: QuizAttemptTimerInput) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const serverOffsetRef = useRef(0);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef<(() => void) | null>(null);

  const setOnExpire = useCallback((handler: (() => void) | null) => {
    onExpireRef.current = handler;
  }, []);

  useEffect(() => {
    if (!enabled || !expiresAt || !serverTime) {
      setTimerReady(false);
      return;
    }

    serverOffsetRef.current = Date.parse(serverTime) - Date.now();
    hasExpiredRef.current = false;
    setTimerReady(false);

    const tick = () => {
      const rem = computeRemainingSeconds(expiresAt, serverOffsetRef.current);
      setRemainingSeconds(rem);
      setTimerReady(true);
      if (rem === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    const resync = () => tick();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [enabled, expiresAt, serverTime]);

  const timerWarning = timerReady && remainingSeconds > 0 && remainingSeconds < 300;
  const isExpired = deriveTimerExpired(
    timerReady,
    enabled,
    expiresAt,
    remainingSeconds,
  );

  return { remainingSeconds, timerWarning, isExpired, setOnExpire };
}

export function formatTimerDisplay(seconds: number, language: string): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const raw =
    h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (language === 'ar') {
    const arabicIndic: Record<string, string> = {
      '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
      '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
    };
    return raw.split('').map((c) => arabicIndic[c] ?? c).join('');
  }
  return raw;
}
