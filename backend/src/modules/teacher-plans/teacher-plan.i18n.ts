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
    CHECKOUT_CREATED: "تم إنشاء عملية الدفع، سيتم تحويلك لإتمام الدفع",
    PLAN_FREE_NO_PAYMENT: "الباقة المجانية لا تتطلب أي عملية دفع",
    YEARLY_NOT_AVAILABLE: "الاشتراك السنوي غير متاح لهذه الباقة",
    PAYMENT_PENDING_EXISTS: "لديك عملية دفع قيد الانتظار لهذه الباقة بالفعل",
    PAYMENT_PROVIDER_UNAVAILABLE: "خدمة الدفع الإلكتروني غير متاحة حالياً، حاول لاحقاً",
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
    CHECKOUT_CREATED: "Checkout created, you will be redirected to complete payment",
    PLAN_FREE_NO_PAYMENT: "The free plan does not require any payment",
    YEARLY_NOT_AVAILABLE: "Yearly billing is not available for this plan",
    PAYMENT_PENDING_EXISTS: "You already have a pending payment for this plan",
    PAYMENT_PROVIDER_UNAVAILABLE: "Online payment is currently unavailable, please try again later",
  },
} as const;

export function getTeacherPlanMessage(key: keyof typeof teacherPlanMessages.ar, locale: string = "ar"): string {
  const lang = locale?.startsWith("ar") ? "ar" : "en";
  return teacherPlanMessages[lang][key] || key;
}
