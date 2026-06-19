import type { EnrollmentStatus } from '@/features/student/types/studentContent';

/** Badge tokens a chapter row can display. Only ever one *state* badge at a time. */
export type ChapterBadgeToken = 'free' | 'subscribed' | 'locked' | 'price';

export interface ChapterStatusConfig {
  /** Whether the chapter content (lessons) is accessible and expandable. */
  accessible: boolean;
  /** Whether clicking the chapter should open the locked modal instead of expanding. */
  locksOnClick: boolean;
  /** Ordered badges to render. Free / Subscribed / Locked are mutually exclusive. */
  badges: ChapterBadgeToken[];
}

/**
 * Single source of truth for how a chapter renders, derived ONLY from the
 * server's `enrollmentStatus`. Free, purchased and locked are distinct business
 * states — accessibility (free) is never treated as enrollment (purchased), and
 * price/lessons are never used to infer status. Unknown values fail safe: no
 * access, no "Subscribed".
 */
export function getChapterStatusConfig(
  status: EnrollmentStatus,
  hasPrice: boolean,
): ChapterStatusConfig {
  switch (status) {
    case 'free':
      // Accessible to everyone, but NOT an enrollment → Free badge only.
      return { accessible: true, locksOnClick: false, badges: ['free'] };

    case 'purchased':
      // Active enrollment → Subscribed only (price optional per design).
      return {
        accessible: true,
        locksOnClick: false,
        badges: hasPrice ? ['price', 'subscribed'] : ['subscribed'],
      };

    case 'locked':
      // Paid and not enrolled → Price + Locked; content stays hidden.
      return {
        accessible: false,
        locksOnClick: true,
        badges: hasPrice ? ['price', 'locked'] : ['locked'],
      };

    default:
      // Unexpected/missing status: never imply enrollment, never expose content.
      return { accessible: false, locksOnClick: false, badges: [] };
  }
}
