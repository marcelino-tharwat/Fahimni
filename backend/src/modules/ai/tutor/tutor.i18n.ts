import { resolveLocale, type Locale } from "../../promo-code/promo-code.i18n.js";

// Reuse the existing Accept-Language resolver (no new i18n framework).
export { resolveLocale };
export type { Locale };

/** STORY-65 — exact bilingual daily-limit-exceeded messages. */
export const TUTOR_DAILY_LIMIT_MESSAGE: Record<Locale, string> = {
  ar: "لقد تجاوزت الحد اليومي للأسئلة. يرجى المحاولة غداً.",
  en: "You've exceeded your daily question limit.",
};
