import { describe, it, expect } from 'vitest';
import {
  localizeDigits,
  formatRelativeTime,
  formatAbsoluteDateTime,
  getInitials,
  getChapterColorClass,
  getLessonProgressColorClass,
  getQuizScoreColorClasses,
  buildWhatsAppLink,
} from './studentEngagementPresentation';

const EM_DASH = '—';

describe('localizeDigits', () => {
  it('maps a number to Arabic-Indic digits in ar', () => {
    expect(localizeDigits(234, 'ar')).toBe('٢٣٤');
  });

  it('leaves a number as Latin digits in en', () => {
    expect(localizeDigits(234, 'en')).toBe('234');
  });

  it('maps a digit string in ar', () => {
    expect(localizeDigits('2026', 'ar')).toBe('٢٠٢٦');
  });

  it('preserves non-digit characters in mixed content (ar)', () => {
    expect(localizeDigits('18/36', 'ar')).toBe('١٨/٣٦');
  });

  it('returns em-dash for null and undefined', () => {
    expect(localizeDigits(null, 'ar')).toBe(EM_DASH);
    expect(localizeDigits(undefined, 'en')).toBe(EM_DASH);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;
  const YEAR = 12 * MONTH;

  it('collapses sub-minute to a fixed literal in both locales', () => {
    expect(formatRelativeTime(ago(30 * SEC), 'ar', now)).toBe('الآن');
    expect(formatRelativeTime(ago(30 * SEC), 'en', now)).toBe('just now');
  });

  it('formats minutes/hours/days/months/years as a real, non-"just now" string', () => {
    // numeric:'auto' can yield words like "yesterday"/"last year", so we assert
    // structure (valid, non-placeholder, distinct from the sub-minute literal)
    // rather than a brittle exact match on the Intl output.
    for (const iso of [ago(2 * MIN), ago(2 * HOUR), ago(DAY), ago(6 * MONTH), ago(2 * YEAR)]) {
      const ar = formatRelativeTime(iso, 'ar', now);
      const en = formatRelativeTime(iso, 'en', now);
      expect(ar).not.toBe(EM_DASH);
      expect(en).not.toBe(EM_DASH);
      expect(en).not.toBe('just now');
      expect(ar).not.toBe('الآن');
      expect(en.length).toBeGreaterThan(0);
    }
  });

  it('returns em-dash for null and for an unparseable date', () => {
    expect(formatRelativeTime(null, 'ar', now)).toBe(EM_DASH);
    expect(formatRelativeTime('not-a-date', 'en', now)).toBe(EM_DASH);
  });
});

describe('formatAbsoluteDateTime', () => {
  const iso = '2026-06-15T15:45:00.000Z';

  it('produces a non-empty, valid string in ar', () => {
    const out = formatAbsoluteDateTime(iso, 'ar');
    expect(out).not.toBe(EM_DASH);
    expect(out).not.toContain('Invalid');
    expect(out.length).toBeGreaterThan(0);
  });

  it('includes the year and month name in en', () => {
    const out = formatAbsoluteDateTime(iso, 'en');
    expect(out).not.toContain('Invalid');
    expect(out).toContain('2026');
    expect(out).toContain('June');
  });

  it('returns em-dash for null and unparseable input', () => {
    expect(formatAbsoluteDateTime(null, 'ar')).toBe(EM_DASH);
    expect(formatAbsoluteDateTime('nope', 'en')).toBe(EM_DASH);
  });
});

describe('getInitials', () => {
  it('takes first char of first two tokens (Arabic)', () => {
    expect(getInitials('يوسف أحمد')).toBe('يأ');
  });

  it('returns single char for a single-word Arabic name', () => {
    expect(getInitials('أحمد')).toBe('أ');
  });

  it('takes first char of first two tokens (English)', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns single char for a single-word English name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('collapses extra internal whitespace', () => {
    expect(getInitials('يوسف    أحمد')).toBe('يأ');
  });

  it('returns em-dash for empty and whitespace-only input', () => {
    expect(getInitials('')).toBe(EM_DASH);
    expect(getInitials('   ')).toBe(EM_DASH);
  });
});

describe('getChapterColorClass', () => {
  it('is deterministic for the same id', () => {
    expect(getChapterColorClass('chapter-abc')).toBe(getChapterColorClass('chapter-abc'));
  });

  it('always returns a class from the palette', () => {
    const palette = new Set([
      'bg-cyan-500',
      'bg-purple-500',
      'bg-success-500',
      'bg-warning-500',
      'bg-navy-500',
      'bg-pink-500',
    ]);
    for (const id of ['a', 'b', 'c', 'ch-1', 'ch-2', 'ch-42', 'الباب الأول']) {
      expect(palette.has(getChapterColorClass(id))).toBe(true);
    }
  });

  it('spreads different ids across more than one color', () => {
    const seen = new Set(
      ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'].map(getChapterColorClass),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('getLessonProgressColorClass', () => {
  it('returns gray when there are no lessons', () => {
    expect(getLessonProgressColorClass(0, 0)).toBe('bg-gray-400');
  });

  it('tiers by completion percentage', () => {
    expect(getLessonProgressColorClass(40, 100)).toBe('bg-danger-500');
    expect(getLessonProgressColorClass(60, 100)).toBe('bg-warning-500');
    expect(getLessonProgressColorClass(90, 100)).toBe('bg-success-500');
  });
});

describe('getQuizScoreColorClasses', () => {
  it('returns neutral bar + muted text for a null score', () => {
    expect(getQuizScoreColorClasses(null)).toEqual({
      barClass: 'bg-gray-200',
      textClass: 'text-gray-400',
    });
  });

  it('tiers by score', () => {
    expect(getQuizScoreColorClasses(30)).toEqual({
      barClass: 'bg-danger-500',
      textClass: 'text-danger-600',
    });
    expect(getQuizScoreColorClasses(60)).toEqual({
      barClass: 'bg-warning-500',
      textClass: 'text-warning-600',
    });
    expect(getQuizScoreColorClasses(95)).toEqual({
      barClass: 'bg-success-500',
      textClass: 'text-success-600',
    });
  });
});

describe('buildWhatsAppLink', () => {
  it('normalizes an Egyptian local number to international', () => {
    const result = buildWhatsAppLink('01234567890');
    expect(result).not.toBeNull();
    expect(result?.waUrl).toBe('https://wa.me/201234567890');
  });

  it('passes through an already-international +20 number', () => {
    const result = buildWhatsAppLink('+201234567890');
    expect(result?.waUrl).toBe('https://wa.me/201234567890');
  });

  it('returns null for null and empty input', () => {
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink('')).toBeNull();
    expect(buildWhatsAppLink('   ')).toBeNull();
  });
});
