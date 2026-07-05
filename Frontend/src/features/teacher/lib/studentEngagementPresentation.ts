/**
 * Presentation helpers for the Teacher Student Engagement pages (STORY-74/75).
 *
 * Pure functions only — no React, no hooks, no global state. Every function is
 * deterministic and unit-testable in isolation; the time formatters accept an
 * explicit `now`/locale rather than reading `Date.now()` or the ambient i18n
 * language, so they can be exercised without a runtime.
 *
 * Note on reuse: `@/shared/lib/utils/toLocalNum` already maps Latin → Arabic
 * digits, but it is impure (reads the global `i18n.language`), accepts only a
 * `number`, and has no null handling. `localizeDigits` below needs a `locale`
 * parameter and null/string support to stay pure, so it re-implements the same
 * `٠-٩` mapping inline rather than delegating.
 */

/** Em-dash placeholder used everywhere a value is missing. */
const EM_DASH = '—';

/** Arabic-Indic digits U+0660..U+0669, indexed by their Latin value 0-9. */
const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** BCP-47 locale used for Intl formatting per app language. */
function intlLocale(locale: 'ar' | 'en'): string {
  return locale === 'ar' ? 'ar-EG' : 'en-US';
}

/**
 * Localize the Latin digits inside `value` to Arabic-Indic digits when
 * `locale` is 'ar'. Non-digit characters are preserved. Numbers are stringified
 * first; `null`/`undefined` render as an em-dash.
 */
export function localizeDigits(
  value: number | string | null | undefined,
  locale: 'ar' | 'en',
): string {
  if (value === null || value === undefined) return EM_DASH;

  const text = typeof value === 'number' ? value.toString() : value;
  if (locale !== 'ar') return text;

  return text.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/** Division steps for relative-time formatting (spec buckets: no weeks). */
const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'minute' }, // < 60 minutes → minutes
  { amount: 24, unit: 'hour' }, // < 24 hours → hours
  { amount: 30, unit: 'day' }, // < 30 days → days
  { amount: 12, unit: 'month' }, // < 12 months → months
  { amount: Number.POSITIVE_INFINITY, unit: 'year' }, // else → years
];

/**
 * Format an ISO-8601 timestamp as a relative string ("منذ ساعتين" /
 * "2 hours ago") using `Intl.RelativeTimeFormat`. Under one minute (either
 * direction) collapses to a fixed "الآن" / "just now" — a value Intl cannot
 * itself produce. A `null` timestamp or an unparseable date renders as an
 * em-dash. `now` is injectable for testability.
 */
export function formatRelativeTime(
  iso: string | null,
  locale: 'ar' | 'en',
  now: Date = new Date(),
): string {
  if (iso === null) return EM_DASH;

  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return EM_DASH;

  // Seconds until `iso`; negative = in the past.
  let duration = (then - now.getTime()) / 1000;

  if (Math.abs(duration) < 60) {
    return locale === 'ar' ? 'الآن' : 'just now';
  }

  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  duration /= 60; // start in minutes

  for (const { amount, unit } of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return EM_DASH; // unreachable (last division is Infinity)
}

/**
 * Format an ISO-8601 timestamp as an absolute datetime
 * ("١٥ يونيو ٢٠٢٦، ٣:٤٥ م" / "June 15, 2026 at 3:45 PM") via
 * `Intl.DateTimeFormat` (long month, numeric day/year, 12-hour clock). A `null`
 * timestamp or an unparseable date renders as an em-dash.
 */
export function formatAbsoluteDateTime(iso: string | null, locale: 'ar' | 'en'): string {
  if (iso === null) return EM_DASH;

  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return EM_DASH;

  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Two-character avatar initials from a full name: first character of each of
 * the first two whitespace-separated tokens. Single-word names yield one
 * character; empty/whitespace-only input yields an em-dash. Arabic characters
 * are preserved as-is.
 *
 * "يوسف أحمد" → "يأ" · "أحمد" → "أ" · "John Doe" → "JD"
 */
export function getInitials(fullName: string): string {
  const tokens = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return EM_DASH;

  const first = firstChar(tokens[0]);
  if (tokens.length === 1) return first;

  return first + firstChar(tokens[1]);
}

/** First Unicode code point of a token (safe for surrogate pairs). */
function firstChar(token: string): string {
  return Array.from(token)[0] ?? '';
}

/** Deterministic chapter-dot palette — all project tokens. */
const CHAPTER_COLORS = [
  'bg-cyan-500',
  'bg-purple-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-navy-500',
  'bg-pink-500',
] as const;

/**
 * Deterministically map a `chapterId` to a Tailwind background class so the
 * same chapter always shows the same dot color across renders and pages. Hash =
 * sum of char codes modulo the palette length.
 */
export function getChapterColorClass(chapterId: string): string {
  let sum = 0;
  for (let i = 0; i < chapterId.length; i += 1) {
    sum += chapterId.charCodeAt(i);
  }
  return CHAPTER_COLORS[sum % CHAPTER_COLORS.length];
}

/**
 * Tailwind fill class for the lessons-watched progress bar, tiered by
 * completion: ≥80% success, ≥50% warning, else danger. A zero (or invalid)
 * denominator has no progress and returns a neutral gray.
 */
export function getLessonProgressColorClass(watched: number, total: number): string {
  if (total <= 0) return 'bg-gray-400';

  const percent = (watched / total) * 100;
  if (percent >= 80) return 'bg-success-500';
  if (percent >= 50) return 'bg-warning-500';
  return 'bg-danger-500';
}

/**
 * Bar + text Tailwind classes for an average quiz score, tiered ≥80/≥50/else.
 * A `null` score (no graded attempts) returns a neutral empty-state bar
 * background (`bg-gray-200`) and muted placeholder text (`text-gray-400`),
 * since the bar element is a background and the value renders as an em-dash.
 */
export function getQuizScoreColorClasses(score: number | null): {
  barClass: string;
  textClass: string;
} {
  if (score === null) {
    return { barClass: 'bg-gray-200', textClass: 'text-gray-400' };
  }
  if (score >= 80) return { barClass: 'bg-success-500', textClass: 'text-success-600' };
  if (score >= 50) return { barClass: 'bg-warning-500', textClass: 'text-warning-600' };
  return { barClass: 'bg-danger-500', textClass: 'text-danger-600' };
}

/**
 * Build a `wa.me` link + display value from a raw phone string. Strips all
 * non-digits; a leading '+' means the number is already international (digits
 * used as-is), an Egyptian local number (leading '0', e.g. "01234567890")
 * has its '0' replaced by the country code '20', and anything else passes
 * through digits-only. Returns `null` for a falsy/whitespace/no-digit phone.
 */
export function buildWhatsAppLink(
  phone: string | null,
): { waUrl: string; displayPhone: string } | null {
  if (!phone || phone.trim() === '') return null;

  const hasPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (digits === '') return null;

  let international: string;
  if (hasPlus) {
    international = digits; // already includes country code
  } else if (digits.startsWith('0')) {
    international = `20${digits.slice(1)}`; // Egyptian local → international
  } else {
    international = digits;
  }

  return {
    waUrl: `https://wa.me/${international}`,
    displayPhone: phone.trim(),
  };
}
