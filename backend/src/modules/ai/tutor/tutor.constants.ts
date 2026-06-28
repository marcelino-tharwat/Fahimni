/**
 * STORY-65 — shared bounds for the teacher-configurable AI-tutor daily cap.
 *
 * Single source of truth so the value is not a magic number across the teacher
 * settings validation, the usage service, and the tutor controller. The platform
 * DEFAULT lives in env (`AI_TUTOR_DAILY_QUERY_LIMIT`, default 20) and also backs
 * the `TeacherProfile.aiTutorDailyQueryLimit` column default.
 */

/** Minimum allowed cap. Zero is NOT "unlimited" — the smallest cap is 1. */
export const AI_TUTOR_LIMIT_MIN = 1;

/**
 * Conservative documented maximum. No prior bound existed in the repo; 1000
 * daily questions per student is far above any legitimate study workload while
 * still preventing an unbounded/abusive value.
 */
export const AI_TUTOR_LIMIT_MAX = 1000;
