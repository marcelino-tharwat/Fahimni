import { describe, it, expect } from 'vitest';
import { getChapterStatusConfig } from './chapterStatus';
import type { EnrollmentStatus } from '@/features/student/types/studentContent';

describe('getChapterStatusConfig', () => {
  it('free → only Free badge, accessible, not lockable', () => {
    const c = getChapterStatusConfig('free', false);
    expect(c.badges).toEqual(['free']);
    expect(c.accessible).toBe(true);
    expect(c.locksOnClick).toBe(false);
  });

  it('free → never shows Subscribed (even if a price somehow exists)', () => {
    expect(getChapterStatusConfig('free', true).badges).toEqual(['free']);
    expect(getChapterStatusConfig('free', true).badges).not.toContain('subscribed');
  });

  it('purchased → only Subscribed (+ price), accessible, no Free/Locked', () => {
    const c = getChapterStatusConfig('purchased', true);
    expect(c.badges).toEqual(['price', 'subscribed']);
    expect(c.accessible).toBe(true);
    expect(c.badges).not.toContain('free');
    expect(c.badges).not.toContain('locked');
  });

  it('purchased without a price → Subscribed only', () => {
    expect(getChapterStatusConfig('purchased', false).badges).toEqual(['subscribed']);
  });

  it('locked → Price + Locked, not accessible, opens modal on click', () => {
    const c = getChapterStatusConfig('locked', true);
    expect(c.badges).toEqual(['price', 'locked']);
    expect(c.accessible).toBe(false);
    expect(c.locksOnClick).toBe(true);
    expect(c.badges).not.toContain('free');
    expect(c.badges).not.toContain('subscribed');
  });

  it('locked without a price → Locked only', () => {
    expect(getChapterStatusConfig('locked', false).badges).toEqual(['locked']);
  });

  it('unknown status → never Subscribed, never accessible', () => {
    const c = getChapterStatusConfig('weird' as unknown as EnrollmentStatus, true);
    expect(c.badges).not.toContain('subscribed');
    expect(c.accessible).toBe(false);
    expect(c.locksOnClick).toBe(false);
  });

  it('Free and Subscribed never appear together for any status', () => {
    (['free', 'purchased', 'locked'] as const).forEach((status) => {
      const badges = getChapterStatusConfig(status, true).badges;
      expect(badges.includes('free') && badges.includes('subscribed')).toBe(false);
    });
  });
});
