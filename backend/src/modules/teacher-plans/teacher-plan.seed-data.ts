/**
 * Canonical teacher-plan catalog — the single source of truth shared by the
 * dev seed script (`prisma/seed-teacher-plans.ts`) and the self-contained
 * tests. Keeping it here (instead of only in the seed script) means automated
 * tests can upsert the plans themselves and never depend on a manual
 * "run seed first" step.
 */
export interface TeacherPlanSeed {
  code: string;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  billingInterval: "MONTHLY";
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, number | boolean>;
}

export const TEACHER_PLANS: TeacherPlanSeed[] = [
  {
    code: "FREE",
    name: "free",
    displayName: "الباقة المجانية",
    description: "ابدأ رحلتك التعليمية مع الباقة المجانية — أدوات أساسية للتدريس",
    monthlyPrice: 0,
    yearlyPrice: null,
    currency: "EGP",
    billingInterval: "MONTHLY",
    isActive: true,
    isRecommended: false,
    sortOrder: 0,
    features: [
      "إنشاء اختبارات بالذكاء الاصطناعي (محدود)",
      "تصحيح مقالات بالذكاء الاصطناعي (محدود)",
      "دروس غير محدودة",
      "محتوى محمي ضد النسخ",
      "دعم عبر واتساب",
    ],
    limits: {
      aiQuizGenerationsPerMonth: 5,
      aiEssayGradingsPerMonth: 10,
      aiContentGenerationsPerMonth: 0,
      aiLessonSummariesPerMonth: 0,
      aiQuestionExplanationsPerMonth: 0,
      maxStudents: 50,
      maxCourses: 3,
      maxQuizzes: 20,
      storageMb: 500,
      analyticsAccess: false,
      studentEngagementAnalytics: false,
      pdfDownloadTracking: true,
      contentProtection: true,
      prioritySupport: false,
    },
  },
  {
    code: "BASIC",
    name: "basic",
    displayName: "الباقة الأساسية",
    description: "مناسبة للمدرسين الجدد — توليد اختبارات وتصحيح تلقائي",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    currency: "EGP",
    billingInterval: "MONTHLY",
    isActive: true,
    isRecommended: false,
    sortOrder: 1,
    features: [
      "إنشاء اختبارات بالذكاء الاصطناعي",
      "تصحيح مقالات بالذكاء الاصطناعي",
      "إنشاء محتوى تعليمي بالذكاء الاصطناعي",
      "دروس غير محدودة",
      "تخزين 5 جيجابايت",
      "محتوى محمي ضد النسخ",
      "تحليلات أساسية",
      "دعم عبر واتساب",
    ],
    limits: {
      aiQuizGenerationsPerMonth: 30,
      aiEssayGradingsPerMonth: 100,
      aiContentGenerationsPerMonth: 10,
      aiLessonSummariesPerMonth: 10,
      aiQuestionExplanationsPerMonth: 10,
      maxStudents: 200,
      maxCourses: 10,
      maxQuizzes: 100,
      storageMb: 5120,
      analyticsAccess: true,
      studentEngagementAnalytics: false,
      pdfDownloadTracking: true,
      contentProtection: true,
      prioritySupport: false,
    },
  },
  {
    code: "PRO",
    name: "pro",
    displayName: "الباقة الاحترافية",
    description: "مناسبة للمدرسين النشطين — كل أدوات الذكاء الاصطناعي والتحليلات",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    currency: "EGP",
    billingInterval: "MONTHLY",
    isActive: true,
    isRecommended: true,
    sortOrder: 2,
    features: [
      "إنشاء اختبارات بالذكاء الاصطناعي (غير محدود تقريباً)",
      "تصحيح مقالات بالذكاء الاصطناعي",
      "إنشاء محتوى تعليمي بالذكاء الاصطناعي",
      "ملخصات دروس بالذكاء الاصطناعي",
      "شروحات ذكية للأسئلة",
      "دروس غير محدودة",
      "تخزين 10 جيجابايت",
      "تحليلات الطلاب",
      "تحليلات تفاعل الطلاب",
      "تتبع تحميل PDF",
      "محتوى محمي ضد النسخ",
      "العلامة المائية للمحتوى",
      "دعم أولوية عبر واتساب",
    ],
    limits: {
      aiQuizGenerationsPerMonth: 100,
      aiEssayGradingsPerMonth: 500,
      aiContentGenerationsPerMonth: 50,
      aiLessonSummariesPerMonth: 50,
      aiQuestionExplanationsPerMonth: 50,
      maxStudents: 500,
      maxCourses: 20,
      maxQuizzes: 500,
      storageMb: 10240,
      analyticsAccess: true,
      studentEngagementAnalytics: true,
      pdfDownloadTracking: true,
      contentProtection: true,
      prioritySupport: true,
    },
  },
  {
    code: "PREMIUM",
    name: "premium",
    displayName: "الباقة المميزة",
    description: "للأكاديميات الكبرى — كل الميزات بدون حدود تقريباً",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: "EGP",
    billingInterval: "MONTHLY",
    isActive: true,
    isRecommended: false,
    sortOrder: 3,
    features: [
      "إنشاء اختبارات بالذكاء الاصطناعي (غير محدود)",
      "تصحيح مقالات بالذكاء الاصطناعي (غير محدود)",
      "إنشاء محتوى تعليمي بالذكاء الاصطناعي",
      "ملخصات دروس بالذكاء الاصطناعي",
      "شروحات ذكية للأسئلة",
      "دروس غير محدودة",
      "تخزين 50 جيجابايت",
      "عدد غير محدود من الطلاب",
      "تحليلات الطلاب المتقدمة",
      "تحليلات تفاعل الطلاب",
      "تتبع تحميل PDF",
      "محتوى محمي ضد النسخ",
      "العلامة المائية للمحتوى",
      "دعم VIP عبر واتساب",
    ],
    limits: {
      aiQuizGenerationsPerMonth: -1,
      aiEssayGradingsPerMonth: -1,
      aiContentGenerationsPerMonth: 200,
      aiLessonSummariesPerMonth: 200,
      aiQuestionExplanationsPerMonth: 200,
      maxStudents: -1,
      maxCourses: 100,
      maxQuizzes: -1,
      storageMb: 51200,
      analyticsAccess: true,
      studentEngagementAnalytics: true,
      pdfDownloadTracking: true,
      contentProtection: true,
      prioritySupport: true,
    },
  },
];
