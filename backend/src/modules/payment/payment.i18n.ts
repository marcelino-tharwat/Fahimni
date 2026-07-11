export const paymentMessages = {
  chapterNotFound: {
    en: "Chapter not found",
    ar: "الفصل غير موجود",
  },
  chapterFree: {
    en: "This chapter is free, no payment required",
    ar: "هذا الفصل مجاني ولا يتطلب دفعاً",
  },
  alreadyEnrolled: {
    en: "Already enrolled in this chapter",
    ar: "أنت مسجل بالفعل في هذا الفصل",
  },
  studentNotFound: {
    en: "Student not found",
    ar: "الطالب غير موجود",
  },
  courseNotAvailable: {
    en: "This content is not currently available",
    ar: "هذا المحتوى غير متاح حاليًا",
  },
  checkoutSuccess: {
    en: "Checkout initiated successfully",
    ar: "تم بدء عملية الدفع بنجاح",
  },
  paymentNotFound: {
    en: "Payment not found",
    ar: "لم يتم العثور على الدفعة",
  },
  forbidden: {
    en: "Forbidden",
    ar: "غير مصرح",
  },
  invalidHmac: {
    en: "Invalid HMAC signature",
    ar: "توقيع غير صالح",
  },
  paymentStatusRetrieved: {
    en: "Payment status retrieved",
    ar: "تم استرجاع حالة الدفع",
  },
  webhookProcessed: {
    en: "Webhook processed",
    ar: "تم معالجة الإشعار",
  },
} as const;

export type Lang = "en" | "ar";

export function getLang(acceptLanguage?: string): Lang {
  return acceptLanguage?.startsWith("ar") ? "ar" : "en";
}
