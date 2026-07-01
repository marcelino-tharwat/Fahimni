export type Locale = "ar" | "en";

export interface RedeemMessages {
  invalidCode: string;
  alreadyUsed: string;
  alreadyEnrolled: string;
  chapterNotFound: string;
  notForThisChapter: string;
  success: string;
}

export const REDEEM_MESSAGES: Record<Locale, RedeemMessages> = {
  ar: {
    invalidCode: "الكود غير صالح",
    alreadyUsed: "تم استخدام هذا الكود من قبل",
    alreadyEnrolled: "أنت مشترك بالفعل في هذا الفصل",
    chapterNotFound: "الفصل غير موجود",
    notForThisChapter: "هذا الكود غير صالح لهذا الفصل",
    success: "تم الاشتراك بنجاح",
  },
  en: {
    invalidCode: "Invalid code",
    alreadyUsed: "Code already used",
    alreadyEnrolled: "Already enrolled in this chapter",
    chapterNotFound: "Chapter not found",
    notForThisChapter: "This code is not valid for this chapter",
    success: "Promo code redeemed successfully",
  },
};

export function resolveLocale(acceptLanguage: string | undefined): Locale {
  return (acceptLanguage ?? "").trim().toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
}
