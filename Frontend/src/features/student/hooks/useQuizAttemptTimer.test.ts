import { describe, it, expect } from 'vitest';
import {
  computeRemainingSeconds,
  deriveTimerExpired,
  formatTimerDisplay,
} from './useQuizAttemptTimer';

describe('formatTimerDisplay', () => {
  it('formats 5 minutes as 05:00', () => {
    expect(formatTimerDisplay(300, 'en')).toBe('05:00');
  });

  it('formats 20 minutes as 20:00', () => {
    expect(formatTimerDisplay(1200, 'en')).toBe('20:00');
  });

  it('formats 45 minutes as 45:00', () => {
    expect(formatTimerDisplay(2700, 'en')).toBe('45:00');
  });

  it('does not hardcode 30:00 for non-30 durations', () => {
    expect(formatTimerDisplay(300, 'en')).not.toBe('30:00');
    expect(formatTimerDisplay(1200, 'en')).not.toBe('30:00');
  });

  it('formats durations over 60 minutes with hours', () => {
    expect(formatTimerDisplay(5400, 'en')).toBe('01:30:00');
  });
});

describe('computeRemainingSeconds', () => {
  it('derives remaining time from expiresAt with server offset', () => {
    const fakeNow = Date.parse('2026-07-01T12:00:00.000Z');
    const offset = fakeNow - Date.now();
    const remaining = computeRemainingSeconds('2026-07-01T12:05:00.000Z', offset);
    expect(remaining).toBe(300);
  });

  it('clamps at zero when deadline passed', () => {
    const remaining = computeRemainingSeconds(
      '2026-07-01T11:59:00.000Z',
      0,
    );
    expect(remaining).toBe(0);
  });
});

describe('deriveTimerExpired', () => {
  it('is false before timer sync (remainingSeconds still 0)', () => {
    expect(
      deriveTimerExpired(false, true, '2026-07-01T12:05:00.000Z', 0),
    ).toBe(false);
  });

  it('is false when time remains after sync', () => {
    expect(
      deriveTimerExpired(true, true, '2026-07-01T12:05:00.000Z', 300),
    ).toBe(false);
  });

  it('is true only after sync when remaining is 0', () => {
    expect(
      deriveTimerExpired(true, true, '2026-07-01T11:59:00.000Z', 0),
    ).toBe(true);
  });
});
