/**
 * Minimal locale support for promo-code redemption messages (STORY-53).
 *
 * The backend has no i18n framework; redemption is the only flow with a
 * bilingual contract, so this small map provides the required Arabic/English
 * domain messages without introducing a new dependency.
 */
export type Locale = "ar" | "en";

export interface RedeemMessages {
  invalidCode: string;
  alreadyUsed: string;
  alreadyEnrolled: string;
  chapterNotFound: string;
  success: string;
}

export const REDEEM_MESSAGES: Record<Locale, RedeemMessages> = {
  ar: {
    invalidCode: "الكود غير صالح",
    alreadyUsed: "تم استخدام هذا الكود من قبل",
    alreadyEnrolled: "أنت مشترك بالفعل في هذا الفصل",
    chapterNotFound: "الفصل غير موجود",
    success: "تم الاشتراك بنجاح",
  },
  en: {
    invalidCode: "Invalid code",
    alreadyUsed: "Code already used",
    alreadyEnrolled: "Already enrolled in this chapter",
    chapterNotFound: "Chapter not found",
    success: "Promo code redeemed successfully",
  },
};

/**
 * Resolve the response locale from the request's Accept-Language header.
 * Arabic is selected only when explicitly requested; otherwise English.
 */
export function resolveLocale(acceptLanguage: string | undefined): Locale {
  return (acceptLanguage ?? "").trim().toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
}
