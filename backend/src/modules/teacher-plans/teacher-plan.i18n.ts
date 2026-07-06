export const teacherPlanMessages = {
  ar: {
    PLAN_NOT_FOUND: "الباقة غير موجودة",
    PLAN_INACTIVE: "الباقة غير متاحة حالياً",
    REQUEST_CREATED: "تم إرسال طلب الاشتراك وسيتم مراجعته",
    REQUEST_DUPLICATE: "لديك طلب اشتراك معلق لهذه الباقة بالفعل",
    ALREADY_ACTIVE: "أنت مشترك في هذه الباقة بالفعل",
    NOT_FOUND: "غير موجود",
    UNAUTHORIZED: "غير مصرح لك",
    INVALID_INTERVAL: "فترة الفوترة غير صالحة",
    QUOTA_EXCEEDED: "لقد وصلت إلى الحد الأقصى لاستخدام الذكاء الاصطناعي في باقتك الحالية",
    USAGE_RECORDED: "تم تسجيل الاستخدام",
    SUBSCRIPTION_REQUIRED: "هذه الميزة تتطلب اشتراكاً في باقة مدفوعة",
    STUDENT_LIMIT_EXCEEDED: "لقد تجاوزت الحد الأقصى لعدد الطلاب في باقتك الحالية",
    STORAGE_LIMIT_EXCEEDED: "لقد تجاوزت الحد الأقصى للتخزين في باقتك الحالية",
  },
  en: {
    PLAN_NOT_FOUND: "Plan not found",
    PLAN_INACTIVE: "Plan is not available",
    REQUEST_CREATED: "Subscription request submitted for review",
    REQUEST_DUPLICATE: "You already have a pending request for this plan",
    ALREADY_ACTIVE: "You are already subscribed to this plan",
    NOT_FOUND: "Not found",
    UNAUTHORIZED: "Unauthorized",
    INVALID_INTERVAL: "Invalid billing interval",
    QUOTA_EXCEEDED: "You have reached the AI usage limit for your current plan",
    USAGE_RECORDED: "Usage recorded",
    SUBSCRIPTION_REQUIRED: "This feature requires a paid plan subscription",
    STUDENT_LIMIT_EXCEEDED: "You have exceeded the maximum student limit for your plan",
    STORAGE_LIMIT_EXCEEDED: "You have exceeded the storage limit for your plan",
  },
} as const;

export function getTeacherPlanMessage(key: keyof typeof teacherPlanMessages.ar, locale: string = "ar"): string {
  const lang = locale?.startsWith("ar") ? "ar" : "en";
  return teacherPlanMessages[lang][key] || key;
}
