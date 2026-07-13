import "dotenv/config";
import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import { TEACHER_PLANS } from "../src/modules/teacher-plans/teacher-plan.seed-data.js";
import { TF_TRUE, TF_FALSE, TF_OPTIONS } from "../src/modules/quizzes/quiz-generation.mapping.js";
import { seedQuizUnlockScenario } from "./seed-quiz-unlock.js";
import {
  CHEMISTRY_CHAPTER_DEFS,
  buildChemistryLessonCatalog,
  chemistryLessonId,
  CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
} from "../src/seed/chemistry-lesson-catalog.js";
import { buildChemistryQuizCatalog, buildQuizLessonLinks } from "../src/seed/chemistry-quiz-catalog.js";
import type { Prisma } from "../src/generated/prisma/client.js";

/**
 * Realistic local dev seed — real-sounding Egyptian names/emails instead of
 * technical labels (teacher.math@..., student1@...), real Egyptian secondary
 * chemistry/physics curriculum content, one simple shared password.
 *
 * Idempotent: every row is upserted by a deterministic id (or natural unique
 * key), so re-running `npx prisma db seed` never duplicates data.
 */

const BCRYPT_ROUNDS = 12;

/**
 * Single, simple, memorable password shared by every seeded account
 * (including admin) so it's trivial to log in and test manually. Satisfies
 * auth.validation.ts's passwordSchema (min 8, upper/lower/digit/special).
 * Override via env if you need something else locally.
 */
export const SEED_SHARED_PASSWORD = process.env.SEED_SHARED_PASSWORD ?? "Pass@1234";

const EMAIL_DOMAIN = "@fahimni.com";
const SEED_NAMESPACE = "6f1e9d2a-8b3c-4a7e-9f0d-1c2b3a4e5f60";
function sid(key: string): string {
  return uuidv5(`fahimni-realistic-seed:${key}`, SEED_NAMESPACE);
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

// ── Accounts ────────────────────────────────────────────────────────────

const ADMIN = {
  id: sid("admin"),
  email: "admin" + EMAIL_DOMAIN,
  fullName: "Admin",
  mobile: "01000000001",
};

const TEACHER_CHEMISTRY = {
  id: sid("teacher-ahmed"),
  profileId: sid("profile-ahmed"),
  email: "ahmed.sami" + EMAIL_DOMAIN,
  fullName: "أحمد سامي",
  mobile: "01000000011",
  subject: "الكيمياء",
  bio: "مدرّس كيمياء لمراحل الثانوية العامة — خبرة 9 سنوات في تدريس الكيمياء وتحضير الطلاب لامتحانات الثانوية العامة.",
};

const TEACHER_PHYSICS = {
  id: sid("teacher-mona"),
  profileId: sid("profile-mona"),
  email: "mona.farouk" + EMAIL_DOMAIN,
  fullName: "منى فاروق",
  mobile: "01000000012",
  subject: "الفيزياء",
  bio: "مدرّسة فيزياء للصف الأول الثانوي — تركز على ربط المفاهيم الفيزيائية بالتطبيقات العملية.",
};

// Pending-review teacher: no content yet, exists purely to exercise the
// admin approval flow end-to-end.
const TEACHER_PENDING = {
  id: sid("teacher-youssef"),
  email: "youssef.adel" + EMAIL_DOMAIN,
  fullName: "يوسف عادل",
  mobile: "01000000013",
  subject: "الأحياء",
  bio: "مدرّس أحياء — بانتظار مراجعة الإدارة لطلب التسجيل.",
};

const STUDENTS = [
  {
    id: sid("student-mona-tarek"),
    profileId: sid("student-profile-mona-tarek"),
    email: "mona.tarek" + EMAIL_DOMAIN,
    fullName: "منى طارق",
    mobile: "01100000001",
    emailVerified: true,
  },
  {
    id: sid("student-youssef-hassan"),
    profileId: sid("student-profile-youssef-hassan"),
    email: "youssef.hassan" + EMAIL_DOMAIN,
    fullName: "يوسف حسن",
    mobile: "01100000002",
    emailVerified: true,
  },
  {
    id: sid("student-nour-ibrahim"),
    profileId: sid("student-profile-nour-ibrahim"),
    email: "nour.ibrahim" + EMAIL_DOMAIN,
    fullName: "نور إبراهيم",
    mobile: "01100000003",
    emailVerified: true,
  },
  {
    id: sid("student-omar-khaled"),
    profileId: sid("student-profile-omar-khaled"),
    email: "omar.khaled" + EMAIL_DOMAIN,
    fullName: "عمر خالد",
    mobile: "01100000004",
    emailVerified: true,
  },
  {
    // Deliberately unverified — for testing the pending-email-verification
    // screen. A normal-looking account otherwise; only emailVerified differs.
    id: sid("student-laila-mostafa"),
    profileId: sid("student-profile-laila-mostafa"),
    email: "laila.mostafa" + EMAIL_DOMAIN,
    fullName: "ليلى مصطفى",
    mobile: "01100000005",
    emailVerified: false,
  },
];
const [MONA_TAREK, YOUSSEF_HASSAN, NOUR_IBRAHIM, OMAR_KHALED, LAILA_MOSTAFA] = STUDENTS;

// ── Stages (platform-owned; matches admin-stages.service.ts's teacherId: null) ──

const STAGE_1 = {
  id: sid("stage-1"),
  name: "الصف الأول الثانوي",
  nameAr: "الصف الأول الثانوي",
  nameEn: "First Secondary",
  description: "المرحلة الثانوية العامة — الصف الأول الثانوي.",
  descriptionAr: "المرحلة الثانوية العامة — الصف الأول الثانوي.",
  descriptionEn: "Egyptian general secondary education — First Secondary year.",
  sortOrder: 1,
};
const STAGE_2 = {
  id: sid("stage-2"),
  name: "الصف الثاني الثانوي",
  nameAr: "الصف الثاني الثانوي",
  nameEn: "Second Secondary",
  description: "المرحلة الثانوية العامة — الصف الثاني الثانوي.",
  descriptionAr: "المرحلة الثانوية العامة — الصف الثاني الثانوي.",
  descriptionEn: "Egyptian general secondary education — Second Secondary year.",
  sortOrder: 2,
};
const STAGE_3 = {
  id: sid("stage-3"),
  name: "الصف الثالث الثانوي",
  nameAr: "الصف الثالث الثانوي",
  nameEn: "Third Secondary",
  description: "المرحلة الثانوية العامة — الصف الثالث الثانوي.",
  descriptionAr: "المرحلة الثانوية العامة — الصف الثالث الثانوي.",
  descriptionEn: "Egyptian general secondary education — Third Secondary year.",
  sortOrder: 3,
};
const STAGES = [STAGE_1, STAGE_2, STAGE_3];

// ── Custom chapters/lessons (real Egyptian curriculum topics) ───────────
// Stage 3 reuses the existing, tested `chemistry-lesson-catalog.ts` (5 units,
// 15 lessons, full RAG-sourced descriptions) — see seedAll() below.

interface CustomLessonDef {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  sortOrder: number;
}
interface CustomChapterDef {
  id: string;
  name: string;
  description: string;
  stageId: string;
  teacherId: string;
  sortOrder: number;
  price: number | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  imageUrl: string;
  lessons: CustomLessonDef[];
}

function customChapter(
  key: string,
  name: string,
  description: string,
  stageId: string,
  teacherId: string,
  sortOrder: number,
  price: number | null,
  term: "FIRST_TERM" | "SECOND_TERM",
  lessons: Array<{ title: string; description: string; durationMinutes: number }>,
): CustomChapterDef {
  return {
    id: sid(`chapter-${key}`),
    name,
    description,
    stageId,
    teacherId,
    sortOrder,
    price,
    term,
    imageUrl: `https://placehold.co/640x360?text=${encodeURIComponent(name)}`,
    lessons: lessons.map((l, i) => ({
      id: sid(`lesson-${key}-${i + 1}`),
      title: l.title,
      description: l.description,
      durationMinutes: l.durationMinutes,
      sortOrder: i + 1,
    })),
  };
}

const CHAPTER_MATTER_STRUCTURE = customChapter(
  "matter-structure",
  "الكيمياء — مقدمة في تركيب المادة",
  "مدخل إلى حالات المادة وتركيب الذرة والجدول الدوري الحديث، تمهيدًا لمنهج الكيمياء في المرحلة الثانوية.",
  STAGE_1.id,
  TEACHER_CHEMISTRY.id,
  1,
  40,
  "FIRST_TERM",
  [
    {
      title: "حالات المادة وخواصها",
      description:
        "حالات المادة الثلاث (صلبة، سائلة، غازية) وخواص كل حالة، والتغيرات بين الحالات (الانصهار والتجمد والتبخر والتكاثف والتسامي).",
      durationMinutes: 20,
    },
    {
      title: "تركيب الذرة",
      description:
        "مكونات الذرة (البروتونات والنيوترونات والإلكترونات)، والعدد الذري والعدد الكتلي، ومفهوم النظائر.",
      durationMinutes: 25,
    },
    {
      title: "الجدول الدوري الحديث",
      description:
        "تنظيم الجدول الدوري في مجموعات ودورات، والعلاقة بين موضع العنصر وخواصه (نصف القطر الذري، السالبية الكهربية).",
      durationMinutes: 25,
    },
  ],
);

const CHAPTER_PHYSICAL_QUANTITIES = customChapter(
  "physical-quantities",
  "الفيزياء — الكميات الفيزيائية والقياس",
  "أساسيات القياس في الفيزياء: الفرق بين الكميات القياسية والمتجهة، ووحدات القياس الدولية.",
  STAGE_1.id,
  TEACHER_PHYSICS.id,
  2,
  null,
  "FIRST_TERM",
  [
    {
      title: "الكميات القياسية والمتجهة",
      description:
        "الفرق بين الكمية القياسية (لها مقدار فقط، مثل الكتلة والزمن) والكمية المتجهة (لها مقدار واتجاه، مثل السرعة المتجهة والقوة).",
      durationMinutes: 20,
    },
    {
      title: "وحدات القياس الدولية",
      description:
        "النظام الدولي للوحدات (SI): الوحدات الأساسية (المتر، الكيلوجرام، الثانية) والوحدات المشتقة، وأهمية توحيد وحدات القياس.",
      durationMinutes: 20,
    },
  ],
);

const CHAPTER_CHEMICAL_BONDING = customChapter(
  "chemical-bonding",
  "الكيمياء — الروابط الكيميائية",
  "أنواع الروابط الكيميائية بين الذرات وكيفية تفسير خواص المركبات في ضوء نوع الرابطة.",
  STAGE_2.id,
  TEACHER_CHEMISTRY.id,
  1,
  80,
  "FIRST_TERM",
  [
    {
      title: "الرابطة الأيونية",
      description:
        "تكوّن الرابطة الأيونية بانتقال إلكترون أو أكثر من ذرة فلزية إلى ذرة لا فلزية، وخواص المركبات الأيونية.",
      durationMinutes: 22,
    },
    {
      title: "الرابطة التساهمية",
      description:
        "تكوّن الرابطة التساهمية بمشاركة أزواج من الإلكترونات بين ذرتين لا فلزيتين، والفرق بين الرابطة الأحادية والثنائية والثلاثية.",
      durationMinutes: 22,
    },
    {
      title: "الرابطة الفلزية",
      description:
        "بحر الإلكترونات الحرة بين أيونات الفلز الموجبة، وتفسير التوصيل الكهربي والحراري وقابلية الطرق والسحب في الفلزات.",
      durationMinutes: 20,
    },
  ],
);

const CHAPTER_SOLUTIONS = customChapter(
  "solutions",
  "الكيمياء — المحاليل والتركيز",
  "أنواع المحاليل وطرق التعبير عن تركيزها والعوامل المؤثرة على الذوبانية.",
  STAGE_2.id,
  TEACHER_CHEMISTRY.id,
  2,
  60,
  "SECOND_TERM",
  [
    {
      title: "أنواع المحاليل",
      description:
        "المذيب والمذاب، والمحاليل المخففة والمركزة والمشبعة وفوق المشبعة، وأمثلة من محاليل صلبة وسائلة وغازية.",
      durationMinutes: 20,
    },
    {
      title: "طرق التعبير عن التركيز",
      description:
        "التركيز المولاري (مول/لتر) والنسبة المئوية الوزنية والحجمية، وكيفية التحويل بين الوحدات المختلفة.",
      durationMinutes: 25,
    },
    {
      title: "الذوبانية والعوامل المؤثرة فيها",
      description:
        "تعريف الذوبانية، وأثر درجة الحرارة وطبيعة المذيب والمذاب على مقدار الذوبانية.",
      durationMinutes: 20,
    },
  ],
);

const CUSTOM_CHAPTERS = [
  CHAPTER_MATTER_STRUCTURE,
  CHAPTER_PHYSICAL_QUANTITIES,
  CHAPTER_CHEMICAL_BONDING,
  CHAPTER_SOLUTIONS,
];

// ── Custom quizzes for the custom chapters (SINGLE_CHAPTER, real Qs) ────

interface CustomQuestionDef {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "ESSAY";
  text: string;
  options: string[];
  correctAnswer: string | null;
  explanation: string;
  points: number;
}
interface CustomQuizDef {
  id: string;
  title: string;
  description: string;
  chapterId: string;
  createdBy: string;
  status: "DRAFT" | "PUBLISHED";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questions: CustomQuestionDef[];
}

function mcq(
  id: string,
  text: string,
  options: string[],
  correctAnswer: string,
  explanation: string,
): CustomQuestionDef {
  return { id, type: "MCQ", text, options, correctAnswer, explanation, points: 2 };
}
function tf(id: string, text: string, correctAnswer: string, explanation: string): CustomQuestionDef {
  return { id, type: "TRUE_FALSE", text, options: [...TF_OPTIONS], correctAnswer, explanation, points: 1 };
}

const QUIZ_MATTER_STRUCTURE: CustomQuizDef = {
  id: sid("quiz-matter-structure"),
  title: "اختبار مقدمة في تركيب المادة",
  description: "أسئلة على حالات المادة وتركيب الذرة والجدول الدوري.",
  chapterId: CHAPTER_MATTER_STRUCTURE.id,
  createdBy: TEACHER_CHEMISTRY.id,
  status: "PUBLISHED",
  difficulty: "EASY",
  questions: [
    mcq(
      sid("q-matter-1"),
      "ما عدد البروتونات في ذرة متعادلة عددها الذري 8؟",
      ["8", "16", "6", "10"],
      "8",
      "العدد الذري يساوي عدد البروتونات في النواة، وفي الذرة المتعادلة يساوي أيضًا عدد الإلكترونات.",
    ),
    tf(
      sid("q-matter-2"),
      "تحتفظ المادة بشكلها وحجمها الثابتين في الحالة الغازية.",
      TF_FALSE,
      "الغازات ليس لها شكل أو حجم ثابت؛ فهي تملأ الإناء الذي توضع فيه بالكامل.",
    ),
  ],
};

const QUIZ_PHYSICAL_QUANTITIES: CustomQuizDef = {
  id: sid("quiz-physical-quantities"),
  title: "اختبار الكميات الفيزيائية والقياس",
  description: "أسئلة على الكميات القياسية والمتجهة ووحدات القياس الدولية.",
  chapterId: CHAPTER_PHYSICAL_QUANTITIES.id,
  createdBy: TEACHER_PHYSICS.id,
  status: "PUBLISHED",
  difficulty: "EASY",
  questions: [
    mcq(
      sid("q-physq-1"),
      "أي مما يلي كمية متجهة؟",
      ["السرعة المتجهة", "الكتلة", "الزمن", "درجة الحرارة"],
      "السرعة المتجهة",
      "الكمية المتجهة لها مقدار واتجاه معًا، والسرعة المتجهة تتحدد بمقدارها واتجاه الحركة.",
    ),
    tf(
      sid("q-physq-2"),
      "وحدة القياس الدولية للكتلة هي الجرام.",
      TF_FALSE,
      "الوحدة الدولية القياسية للكتلة هي الكيلوجرام (kg) وليس الجرام.",
    ),
  ],
};

const QUIZ_CHEMICAL_BONDING: CustomQuizDef = {
  id: sid("quiz-chemical-bonding"),
  title: "اختبار الروابط الكيميائية",
  description: "أسئلة على أنواع الروابط الكيميائية بين الذرات.",
  chapterId: CHAPTER_CHEMICAL_BONDING.id,
  createdBy: TEACHER_CHEMISTRY.id,
  status: "PUBLISHED",
  difficulty: "MEDIUM",
  questions: [
    mcq(
      sid("q-bond-1"),
      "أي نوع من الروابط ينتج عن انتقال إلكترونات من ذرة إلى أخرى؟",
      ["الرابطة الأيونية", "الرابطة التساهمية", "الرابطة الفلزية", "رابطة هيدروجينية"],
      "الرابطة الأيونية",
      "الرابطة الأيونية تنشأ من انتقال إلكترون أو أكثر من ذرة فلزية إلى ذرة لا فلزية.",
    ),
    tf(
      sid("q-bond-2"),
      "الرابطة التساهمية تنشأ عن مشاركة زوج أو أكثر من الإلكترونات بين ذرتين.",
      TF_TRUE,
      "المشاركة الإلكترونية بين ذرتين لا فلزيتين تكوّن الرابطة التساهمية.",
    ),
  ],
};

// Deliberately DRAFT — demonstrates the visibility/status toggle at stage-2
// level too (stage 3's catalog already has its own draft quiz).
const QUIZ_SOLUTIONS: CustomQuizDef = {
  id: sid("quiz-solutions"),
  title: "اختبار المحاليل والتركيز",
  description: "أسئلة على أنواع المحاليل وطرق التعبير عن التركيز.",
  chapterId: CHAPTER_SOLUTIONS.id,
  createdBy: TEACHER_CHEMISTRY.id,
  status: "DRAFT",
  difficulty: "HARD",
  questions: [
    mcq(
      sid("q-sol-1"),
      "وحدة قياس التركيز المولاري هي:",
      ["مول/لتر", "جرام/مول", "لتر/مول", "مول فقط"],
      "مول/لتر",
      "التركيز المولاري يُعبَّر عنه بعدد مولات المذاب مقسومًا على حجم المحلول باللتر.",
    ),
    tf(
      sid("q-sol-2"),
      "زيادة درجة الحرارة تزيد دائمًا من ذوبانية جميع المواد الصلبة في الماء.",
      TF_FALSE,
      "معظم المواد الصلبة تزداد ذوبانيتها بارتفاع الحرارة، لكن توجد استثناءات تقل فيها الذوبانية بارتفاع الحرارة.",
    ),
  ],
};

const CUSTOM_QUIZZES = [
  QUIZ_MATTER_STRUCTURE,
  QUIZ_PHYSICAL_QUANTITIES,
  QUIZ_CHEMICAL_BONDING,
  QUIZ_SOLUTIONS,
];

// ── Extra stage-3 quizzes demonstrating MULTI_CHAPTER / FULL_CURRICULUM ──
// (the reused chemistry-quiz-catalog only covers SINGLE_CHAPTER + intra-
// chapter SELECTED_LESSONS; these two are additive, on top of it.)

const CHEM_CH1_ID = CHEMISTRY_CHAPTER_DEFS[0]!.id; // العناصر الانتقالية
const CHEM_CH2_ID = CHEMISTRY_CHAPTER_DEFS[1]!.id; // التحليل الكيميائي

const QUIZ_MULTI_CHAPTER_REVIEW = {
  id: sid("quiz-multi-chapter-review"),
  title: "مراجعة شاملة — الوحدتان الأولى والثانية",
  description: "اختبار مراجعة يغطي العناصر الانتقالية والتحليل الكيميائي معًا.",
  chapterId: CHEM_CH1_ID,
  sourceChapterIds: [CHEM_CH1_ID, CHEM_CH2_ID],
  createdBy: TEACHER_CHEMISTRY.id,
  status: "PUBLISHED" as const,
  questions: [
    mcq(
      sid("q-multi-1"),
      "أي مما يلي مثال على عنصر انتقالي؟",
      ["الحديد", "الصوديوم", "الكالسيوم", "الكلور"],
      "الحديد",
      "الحديد عنصر انتقالي يُظهر أكثر من حالة تأكسد بسبب تقارب طاقات مستويات (n-1)d و ns.",
    ),
    tf(
      sid("q-multi-2"),
      "يمكن استخدام المعايرة لتحديد تركيز حمض مجهول.",
      TF_TRUE,
      "المعايرة تعتمد على تفاعل كمية معلومة من قاعدة قياسية مع الحمض المجهول لحساب تركيزه.",
    ),
    {
      id: sid("q-multi-3"),
      type: "ESSAY" as const,
      text: "قارن بين التحليل الكيفي والتحليل الكمي في الكيمياء التحليلية.",
      options: [],
      correctAnswer: null,
      explanation:
        "التحليل الكيفي يحدد نوع المكونات الموجودة، بينما التحليل الكمي يحدد كمياتها بدقة باستخدام أساليب مثل المعايرة والوزن.",
      points: 3,
    },
  ],
};

const QUIZ_FULL_CURRICULUM_FINAL = {
  id: sid("quiz-full-curriculum-final"),
  title: "الاختبار الشامل النهائي — الصف الثالث الثانوي",
  description: "اختبار شامل يغطي منهج الكيمياء بالكامل للصف الثالث الثانوي.",
  chapterId: CHEM_CH1_ID,
  createdBy: TEACHER_CHEMISTRY.id,
  status: "PUBLISHED" as const,
  questions: [
    mcq(
      sid("q-final-1"),
      "في الخلية الجلفانية، يحدث الاختزال عند:",
      ["المهبط (الكاثود)", "المصعد (الأنود)", "المحلول الوسيط", "لا يحدث اختزال"],
      "المهبط (الكاثود)",
      "الاختزال (اكتساب إلكترونات) يحدث دائمًا عند المهبط في الخلية الجلفانية.",
    ),
    tf(
      sid("q-final-2"),
      "البوليمرات الطبيعية مثل النشا والسليولوز تتكون من وحدات جلوكوز متكررة.",
      TF_TRUE,
      "كلاهما بوليمر طبيعي أساسه وحدات الجلوكوز، لكنهما يختلفان في نوع الرابطة بين الوحدات.",
    ),
    {
      id: sid("q-final-3"),
      type: "ESSAY" as const,
      text: "اشرح العلاقة بين مبدأ لوشاتلييه وتوقع اتجاه انزياح الاتزان عند تغيير الظروف.",
      options: [],
      correctAnswer: null,
      explanation:
        "ينص المبدأ على أن النظام الموجود في اتزان يقاوم أي تغيير خارجي بالانزياح في الاتجاه الذي يقلل من أثر هذا التغيير.",
      points: 3,
    },
  ],
};

// ── Promo codes ───────────────────────────────────────────────────────
// PlatformPromoCode (admin-managed, COURSE_PURCHASE) — active / expired / disabled.
const PROMO_ACTIVE = {
  id: sid("promo-active"),
  code: "WELCOME10",
  discountValue: 10,
};
const PROMO_EXPIRED = {
  id: sid("promo-expired"),
  code: "SUMMER23",
  discountValue: 15,
};
const PROMO_DISABLED = {
  id: sid("promo-disabled"),
  code: "OLDPROMO",
  discountValue: 20,
};

// PromoCode (teacher single-use, chapter-bound) — one used, one still available.
const TEACHER_PROMO_USED = {
  id: sid("teacher-promo-used"),
  code: "AHMED001",
  chapterId: CHAPTER_CHEMICAL_BONDING.id,
};
const TEACHER_PROMO_UNUSED = {
  id: sid("teacher-promo-unused"),
  code: "AHMED002",
  chapterId: CHAPTER_SOLUTIONS.id,
};

// ── Seed ────────────────────────────────────────────────────────────────

async function seedAll(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_SHARED_PASSWORD, BCRYPT_ROUNDS);

  await prisma.$transaction(
    async (tx) => {
      // 1. Teacher plan catalog (canonical, unrelated to accounts).
      for (const plan of TEACHER_PLANS) {
        await tx.teacherPlan.upsert({
          where: { code: plan.code },
          update: {
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            isActive: plan.isActive,
            isRecommended: plan.isRecommended,
            sortOrder: plan.sortOrder,
            features: plan.features,
            limits: plan.limits,
          },
          create: {
            code: plan.code,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            isActive: plan.isActive,
            isRecommended: plan.isRecommended,
            sortOrder: plan.sortOrder,
            features: plan.features,
            limits: plan.limits,
          },
        });
      }

      // 2. Admin.
      await tx.user.upsert({
        where: { email: ADMIN.email },
        update: { fullName: ADMIN.fullName, status: "ACTIVE", emailVerified: true },
        create: {
          id: ADMIN.id,
          email: ADMIN.email,
          fullName: ADMIN.fullName,
          mobile: ADMIN.mobile,
          password: passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: true,
        },
      });

      // 3. Teachers (approved/active).
      for (const t of [TEACHER_CHEMISTRY, TEACHER_PHYSICS]) {
        await tx.user.upsert({
          where: { email: t.email },
          update: {
            fullName: t.fullName,
            status: "ACTIVE",
            teacherApprovalState: "APPROVED",
            emailVerified: true,
          },
          create: {
            id: t.id,
            email: t.email,
            fullName: t.fullName,
            mobile: t.mobile,
            password: passwordHash,
            role: "OPERATION",
            status: "ACTIVE",
            teacherApprovalState: "APPROVED",
            emailVerified: true,
          },
        });
        await tx.teacherProfile.upsert({
          where: { userId: t.id },
          update: { subject: t.subject, bio: t.bio },
          create: { id: t.profileId, userId: t.id, subject: t.subject, bio: t.bio },
        });
      }

      // 3b. Pending-review teacher — no profile/content yet; exists to
      // exercise the admin approval flow.
      await tx.user.upsert({
        where: { email: TEACHER_PENDING.email },
        update: {
          fullName: TEACHER_PENDING.fullName,
          status: "INACTIVE",
          teacherApprovalState: "PENDING_REVIEW",
          emailVerified: true,
        },
        create: {
          id: TEACHER_PENDING.id,
          email: TEACHER_PENDING.email,
          fullName: TEACHER_PENDING.fullName,
          mobile: TEACHER_PENDING.mobile,
          password: passwordHash,
          role: "OPERATION",
          status: "INACTIVE",
          teacherApprovalState: "PENDING_REVIEW",
          emailVerified: true,
        },
      });
      await tx.teacherRegistrationRequest.upsert({
        where: { publicReference: "REALSEED_REQ_001" },
        update: { status: "PENDING", userId: TEACHER_PENDING.id },
        create: {
          id: sid("req-pending-youssef"),
          publicReference: "REALSEED_REQ_001",
          fullName: TEACHER_PENDING.fullName,
          email: TEACHER_PENDING.email,
          mobile: TEACHER_PENDING.mobile,
          subject: TEACHER_PENDING.subject,
          bio: TEACHER_PENDING.bio,
          status: "PENDING",
          proofDocuments: [
            {
              originalName: "certificate.pdf",
              mimeType: "application/pdf",
              size: 12345,
              path: "teacher-registration-requests/REALSEED/certificate.pdf",
            },
          ],
          userId: TEACHER_PENDING.id,
        },
      });

      // 4. Students.
      for (const s of STUDENTS) {
        await tx.user.upsert({
          where: { email: s.email },
          update: { fullName: s.fullName, status: "ACTIVE", emailVerified: s.emailVerified },
          create: {
            id: s.id,
            email: s.email,
            fullName: s.fullName,
            mobile: s.mobile,
            password: passwordHash,
            role: "STUDENT",
            status: "ACTIVE",
            emailVerified: s.emailVerified,
          },
        });
      }
      // Stage assignment: Mona Tarek + Omar Khaled → 3rd secondary,
      // Youssef Hassan → 2nd secondary, Nour Ibrahim + Laila Mostafa → 1st secondary.
      const STUDENT_STAGE: Record<string, string> = {
        [MONA_TAREK!.id]: STAGE_3.id,
        [OMAR_KHALED!.id]: STAGE_3.id,
        [YOUSSEF_HASSAN!.id]: STAGE_2.id,
        [NOUR_IBRAHIM!.id]: STAGE_1.id,
        [LAILA_MOSTAFA!.id]: STAGE_1.id,
      };

      // 5. Stages (platform-owned).
      for (const st of STAGES) {
        await tx.stage.upsert({
          where: { id: st.id },
          update: {
            name: st.name,
            nameAr: st.nameAr,
            nameEn: st.nameEn,
            description: st.description,
            descriptionAr: st.descriptionAr,
            descriptionEn: st.descriptionEn,
            sortOrder: st.sortOrder,
            isActive: true,
            teacherId: null,
          },
          create: {
            id: st.id,
            name: st.name,
            nameAr: st.nameAr,
            nameEn: st.nameEn,
            description: st.description,
            descriptionAr: st.descriptionAr,
            descriptionEn: st.descriptionEn,
            sortOrder: st.sortOrder,
            isActive: true,
            teacherId: null,
          },
        });
      }

      // 5b. Student profiles (needs stages to exist).
      for (const s of STUDENTS) {
        await tx.studentProfile.upsert({
          where: { userId: s.id },
          update: { stageId: STUDENT_STAGE[s.id]! },
          create: { id: s.profileId, userId: s.id, stageId: STUDENT_STAGE[s.id]! },
        });
      }

      // 6. Custom chapters + lessons (stages 1 & 2).
      for (const ch of CUSTOM_CHAPTERS) {
        await tx.chapter.upsert({
          where: { id: ch.id },
          update: {
            name: ch.name,
            description: ch.description,
            sortOrder: ch.sortOrder,
            price: ch.price,
            term: ch.term,
            imageUrl: ch.imageUrl,
            isVisible: true,
            stageId: ch.stageId,
            teacherId: ch.teacherId,
            deletedAt: null,
          },
          create: {
            id: ch.id,
            name: ch.name,
            description: ch.description,
            sortOrder: ch.sortOrder,
            price: ch.price,
            term: ch.term,
            imageUrl: ch.imageUrl,
            isVisible: true,
            stageId: ch.stageId,
            teacherId: ch.teacherId,
          },
        });
        for (const l of ch.lessons) {
          await tx.lesson.upsert({
            where: { id: l.id },
            update: {
              title: l.title,
              description: l.description,
              durationMinutes: l.durationMinutes,
              sortOrder: l.sortOrder,
              chapterId: ch.id,
              deletedAt: null,
            },
            create: {
              id: l.id,
              title: l.title,
              description: l.description,
              durationMinutes: l.durationMinutes,
              sortOrder: l.sortOrder,
              chapterId: ch.id,
            },
          });
        }
      }

      // 7. Stage-3 chapters + lessons (reused, tested real chemistry catalog).
      const chemLessons = buildChemistryLessonCatalog();
      const chemChapterPrices = [null, 45, 55, 65, 75] as const;
      const chemChapterTerms = [
        "FIRST_TERM",
        "FIRST_TERM",
        "SECOND_TERM",
        "SECOND_TERM",
        "SECOND_TERM",
      ] as const;
      const chemChapterDescriptions = [
        "دراسة العناصر الانتقالية وخواصها المميزة وحالات تأكسدها المتعددة.",
        "أساليب التحليل الكيفي والكمي في الكيمياء، بما في ذلك المعايرة وحساباتها.",
        "مفهوم الاتزان الديناميكي وثابت الاتزان والعوامل المؤثرة على موضع الاتزان.",
        "الخلايا الجلفانية والتحليل الكهربي وقوانين فاراداي في الكيمياء الكهربية.",
        "الهيدروكربونات والكحولات والأحماض الكربوكسيلية والبوليمرات في الكيمياء العضوية.",
      ];
      for (let ci = 0; ci < CHEMISTRY_CHAPTER_DEFS.length; ci++) {
        const chDef = CHEMISTRY_CHAPTER_DEFS[ci]!;
        await tx.chapter.upsert({
          where: { id: chDef.id },
          update: {
            name: chDef.name,
            description: chemChapterDescriptions[ci]!,
            sortOrder: ci + 1,
            price: chemChapterPrices[ci] ?? null,
            term: chemChapterTerms[ci] ?? "FIRST_TERM",
            imageUrl: `https://placehold.co/640x360?text=${encodeURIComponent(chDef.name)}`,
            isVisible: true,
            stageId: STAGE_3.id,
            teacherId: TEACHER_CHEMISTRY.id,
            deletedAt: null,
          },
          create: {
            id: chDef.id,
            name: chDef.name,
            description: chemChapterDescriptions[ci]!,
            sortOrder: ci + 1,
            price: chemChapterPrices[ci] ?? null,
            term: chemChapterTerms[ci] ?? "FIRST_TERM",
            imageUrl: `https://placehold.co/640x360?text=${encodeURIComponent(chDef.name)}`,
            isVisible: true,
            stageId: STAGE_3.id,
            teacherId: TEACHER_CHEMISTRY.id,
          },
        });
      }
      for (const l of chemLessons) {
        await tx.lesson.upsert({
          where: { id: l.id },
          update: {
            title: l.title,
            description: l.description,
            durationMinutes: l.durationMinutes,
            youtubeUrl: l.youtubeUrl,
            sortOrder: l.sortOrder,
            chapterId: l.chapterId,
            deletedAt: null,
          },
          create: {
            id: l.id,
            title: l.title,
            description: l.description,
            durationMinutes: l.durationMinutes,
            youtubeUrl: l.youtubeUrl,
            sortOrder: l.sortOrder,
            chapterId: l.chapterId,
          },
        });
      }

      // 8. Custom quizzes + questions (stages 1 & 2).
      for (const q of CUSTOM_QUIZZES) {
        const totalPoints = q.questions.reduce((sum, item) => sum + item.points, 0);
        await tx.quiz.upsert({
          where: { id: q.id },
          update: {
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: 15,
            passingScore: 50,
            difficulty: q.difficulty,
            createdBy: q.createdBy,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
          create: {
            id: q.id,
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: 15,
            passingScore: 50,
            difficulty: q.difficulty,
            createdBy: q.createdBy,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
        });
        for (const [i, question] of q.questions.entries()) {
          await tx.question.upsert({
            where: { id: question.id },
            update: {
              quizId: q.id,
              type: question.type,
              text: question.text,
              options: question.options as unknown as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: i + 1,
              points: question.points,
            },
            create: {
              id: question.id,
              quizId: q.id,
              type: question.type,
              text: question.text,
              options: question.options as unknown as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: i + 1,
              points: question.points,
            },
          });
        }
      }

      // 9. Stage-3 chapter quizzes + questions (reused chemistry catalog:
      // SINGLE_CHAPTER, mixes PUBLISHED/DRAFT + CHAPTER/SELECTED_LESSONS).
      const chemQuizzes = buildChemistryQuizCatalog();
      // Order matches buildChemistryQuizCatalog()'s own push order: 5 chapter
      // quizzes (transition elements, analysis, equilibrium, electrochemistry,
      // organic), then optional-lesson, gate, and multi-lesson quizzes.
      const chemQuizDifficulties: Array<"EASY" | "MEDIUM" | "HARD"> = [
        "MEDIUM",
        "EASY",
        "HARD",
        "MEDIUM",
        "HARD",
        "EASY",
        "EASY",
        "MEDIUM",
      ];
      for (const [qi, q] of chemQuizzes.entries()) {
        const totalPoints = q.questions.reduce((sum, item) => sum + item.points, 0);
        const difficulty = chemQuizDifficulties[qi] ?? "MEDIUM";
        await tx.quiz.upsert({
          where: { id: q.id },
          update: {
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            contentScope: q.contentScope,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: q.durationMinutes,
            passingScore: q.passingScore,
            difficulty,
            createdBy: TEACHER_CHEMISTRY.id,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
          create: {
            id: q.id,
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            contentScope: q.contentScope,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: q.durationMinutes,
            passingScore: q.passingScore,
            difficulty,
            createdBy: TEACHER_CHEMISTRY.id,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
        });
        for (const question of q.questions) {
          await tx.question.upsert({
            where: { id: question.id },
            update: {
              quizId: question.quizId,
              type: question.type,
              text: question.text,
              options: question.options,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: question.sortOrder,
              points: question.points,
            },
            create: {
              id: question.id,
              quizId: question.quizId,
              type: question.type,
              text: question.text,
              options: question.options,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: question.sortOrder,
              points: question.points,
            },
          });
        }
      }
      for (const link of buildQuizLessonLinks()) {
        await tx.quizLesson.upsert({
          where: { quizId_lessonId: { quizId: link.quizId, lessonId: link.lessonId } },
          update: {},
          create: { quizId: link.quizId, lessonId: link.lessonId },
        });
      }
      // Progression-gate wiring: chapter-1 lesson-1 requires passing the gate quiz.
      await tx.lesson.update({
        where: { id: chemistryLessonId(0, 0) },
        data: { requiredQuizId: CHEMISTRY_REQUIRED_GATE_QUIZ_ID },
      });

      // 10. Extra stage-3 quizzes: MULTI_CHAPTER + FULL_CURRICULUM sourceScope.
      for (const q of [QUIZ_MULTI_CHAPTER_REVIEW, QUIZ_FULL_CURRICULUM_FINAL]) {
        const isMulti = "sourceChapterIds" in q;
        const totalPoints = q.questions.reduce((sum, item) => sum + item.points, 0);
        await tx.quiz.upsert({
          where: { id: q.id },
          update: {
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            sourceScope: isMulti ? "MULTI_CHAPTER" : "FULL_CURRICULUM",
            sourceChapterIds: isMulti ? (q as typeof QUIZ_MULTI_CHAPTER_REVIEW).sourceChapterIds : [],
            sourceStageId: isMulti ? null : STAGE_3.id,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: 30,
            passingScore: 50,
            difficulty: "HARD",
            createdBy: q.createdBy,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
          create: {
            id: q.id,
            title: q.title,
            description: q.description,
            chapterId: q.chapterId,
            sourceScope: isMulti ? "MULTI_CHAPTER" : "FULL_CURRICULUM",
            sourceChapterIds: isMulti ? (q as typeof QUIZ_MULTI_CHAPTER_REVIEW).sourceChapterIds : [],
            sourceStageId: isMulti ? null : STAGE_3.id,
            status: q.status,
            questionCount: q.questions.length,
            totalPoints,
            durationMinutes: 30,
            passingScore: 50,
            difficulty: "HARD",
            createdBy: q.createdBy,
            publishedAt: q.status === "PUBLISHED" ? now : null,
          },
        });
        for (const [i, question] of q.questions.entries()) {
          await tx.question.upsert({
            where: { id: question.id },
            update: {
              quizId: q.id,
              type: question.type,
              text: question.text,
              options: question.options as unknown as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: i + 1,
              points: question.points,
            },
            create: {
              id: question.id,
              quizId: q.id,
              type: question.type,
              text: question.text,
              options: question.options as unknown as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              sortOrder: i + 1,
              points: question.points,
            },
          });
        }
      }

      // 11. Promo codes.
      await tx.platformPromoCode.upsert({
        where: { code: PROMO_ACTIVE.code },
        update: {
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_ACTIVE.discountValue,
          isActive: true,
          expiresAt: null,
          createdById: ADMIN.id,
        },
        create: {
          id: PROMO_ACTIVE.id,
          code: PROMO_ACTIVE.code,
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_ACTIVE.discountValue,
          isActive: true,
          createdById: ADMIN.id,
        },
      });
      await tx.platformPromoCode.upsert({
        where: { code: PROMO_EXPIRED.code },
        update: {
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_EXPIRED.discountValue,
          isActive: true,
          expiresAt: daysAgo(30),
          createdById: ADMIN.id,
        },
        create: {
          id: PROMO_EXPIRED.id,
          code: PROMO_EXPIRED.code,
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_EXPIRED.discountValue,
          isActive: true,
          expiresAt: daysAgo(30),
          createdById: ADMIN.id,
        },
      });
      await tx.platformPromoCode.upsert({
        where: { code: PROMO_DISABLED.code },
        update: {
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_DISABLED.discountValue,
          isActive: false,
          createdById: ADMIN.id,
        },
        create: {
          id: PROMO_DISABLED.id,
          code: PROMO_DISABLED.code,
          scope: "COURSE_PURCHASE",
          discountType: "PERCENTAGE",
          discountValue: PROMO_DISABLED.discountValue,
          isActive: false,
          createdById: ADMIN.id,
        },
      });

      await tx.promoCode.upsert({
        where: { code: TEACHER_PROMO_USED.code },
        update: {
          isUsed: true,
          usedByStudentId: YOUSSEF_HASSAN!.id,
          usedAt: daysAgo(2),
          chapterId: TEACHER_PROMO_USED.chapterId,
          createdById: TEACHER_CHEMISTRY.id,
        },
        create: {
          id: TEACHER_PROMO_USED.id,
          code: TEACHER_PROMO_USED.code,
          isUsed: true,
          usedByStudentId: YOUSSEF_HASSAN!.id,
          usedAt: daysAgo(2),
          chapterId: TEACHER_PROMO_USED.chapterId,
          createdById: TEACHER_CHEMISTRY.id,
        },
      });
      await tx.promoCode.upsert({
        where: { code: TEACHER_PROMO_UNUSED.code },
        update: {
          isUsed: false,
          chapterId: TEACHER_PROMO_UNUSED.chapterId,
          createdById: TEACHER_CHEMISTRY.id,
        },
        create: {
          id: TEACHER_PROMO_UNUSED.id,
          code: TEACHER_PROMO_UNUSED.code,
          isUsed: false,
          chapterId: TEACHER_PROMO_UNUSED.chapterId,
          createdById: TEACHER_CHEMISTRY.id,
          expiresAt: daysFromNow(60),
        },
      });

      // 12. Enrollments + payments.
      // Mona Tarek: one free chapter, one PAYMOB-paid chapter.
      await tx.enrollment.upsert({
        where: { studentId_chapterId: { studentId: MONA_TAREK!.id, chapterId: CHEM_CH1_ID } },
        update: { status: "ACTIVE", price: 0, paymentMethod: "FREE" },
        create: {
          id: sid("enr-mona-ch1"),
          studentId: MONA_TAREK!.id,
          chapterId: CHEM_CH1_ID,
          status: "ACTIVE",
          price: 0,
          paymentMethod: "FREE",
        },
      });
      const CHEM_ORGANIC_ID = CHEMISTRY_CHAPTER_DEFS[4]!.id;
      await tx.enrollment.upsert({
        where: { studentId_chapterId: { studentId: MONA_TAREK!.id, chapterId: CHEM_ORGANIC_ID } },
        update: { status: "ACTIVE", price: 75, paymentMethod: "PAYMOB" },
        create: {
          id: sid("enr-mona-organic"),
          studentId: MONA_TAREK!.id,
          chapterId: CHEM_ORGANIC_ID,
          status: "ACTIVE",
          price: 75,
          paymentMethod: "PAYMOB",
        },
      });
      await tx.paymentTransaction.upsert({
        where: { id: sid("pt-mona-organic") },
        update: {
          studentId: MONA_TAREK!.id,
          chapterId: CHEM_ORGANIC_ID,
          paymobOrderId: "REALSEED_ORD_001",
          amount: 75,
          status: "SUCCESS",
        },
        create: {
          id: sid("pt-mona-organic"),
          studentId: MONA_TAREK!.id,
          chapterId: CHEM_ORGANIC_ID,
          paymobOrderId: "REALSEED_ORD_001",
          amount: 75,
          status: "SUCCESS",
          createdAt: daysAgo(7),
        },
      });

      // Youssef Hassan: PROMO-enrolled (free via teacher single-use code) in bonding.
      await tx.enrollment.upsert({
        where: {
          studentId_chapterId: { studentId: YOUSSEF_HASSAN!.id, chapterId: CHAPTER_CHEMICAL_BONDING.id },
        },
        update: { status: "ACTIVE", price: 0, paymentMethod: "PROMO", promoCodeId: TEACHER_PROMO_USED.id },
        create: {
          id: sid("enr-youssef-bonding"),
          studentId: YOUSSEF_HASSAN!.id,
          chapterId: CHAPTER_CHEMICAL_BONDING.id,
          status: "ACTIVE",
          price: 0,
          paymentMethod: "PROMO",
          promoCodeId: TEACHER_PROMO_USED.id,
        },
      });

      // Nour Ibrahim: PAYMOB purchase discounted via the active platform promo.
      const nourAmountBefore = 40;
      const nourDiscount = (nourAmountBefore * PROMO_ACTIVE.discountValue) / 100;
      const nourAmountAfter = nourAmountBefore - nourDiscount;
      await tx.enrollment.upsert({
        where: {
          studentId_chapterId: { studentId: NOUR_IBRAHIM!.id, chapterId: CHAPTER_MATTER_STRUCTURE.id },
        },
        update: { status: "ACTIVE", price: nourAmountAfter, paymentMethod: "PAYMOB" },
        create: {
          id: sid("enr-nour-matter"),
          studentId: NOUR_IBRAHIM!.id,
          chapterId: CHAPTER_MATTER_STRUCTURE.id,
          status: "ACTIVE",
          price: nourAmountAfter,
          paymentMethod: "PAYMOB",
        },
      });
      await tx.paymentTransaction.upsert({
        where: { id: sid("pt-nour-matter") },
        update: {
          studentId: NOUR_IBRAHIM!.id,
          chapterId: CHAPTER_MATTER_STRUCTURE.id,
          paymobOrderId: "REALSEED_ORD_002",
          amount: nourAmountAfter,
          status: "SUCCESS",
        },
        create: {
          id: sid("pt-nour-matter"),
          studentId: NOUR_IBRAHIM!.id,
          chapterId: CHAPTER_MATTER_STRUCTURE.id,
          paymobOrderId: "REALSEED_ORD_002",
          amount: nourAmountAfter,
          status: "SUCCESS",
          createdAt: daysAgo(4),
        },
      });
      await tx.platformPromoRedemption.upsert({
        where: { id: sid("redemption-nour") },
        update: {
          promoCodeId: PROMO_ACTIVE.id,
          userId: NOUR_IBRAHIM!.id,
          amountBefore: nourAmountBefore,
          discount: nourDiscount,
          amountAfter: nourAmountAfter,
        },
        create: {
          id: sid("redemption-nour"),
          promoCodeId: PROMO_ACTIVE.id,
          userId: NOUR_IBRAHIM!.id,
          amountBefore: nourAmountBefore,
          discount: nourDiscount,
          amountAfter: nourAmountAfter,
        },
      });

      // Omar Khaled: verified, no enrollments (empty-state fixture).
      // Laila Mostafa: unverified, no enrollments.

      // 13. Quiz attempts (Mona Tarek) — reuse ids straight off the catalog
      // objects built above so they always match the actual seeded rows.
      const gateQuiz = chemQuizzes.find((q) => q.id === CHEMISTRY_REQUIRED_GATE_QUIZ_ID)!;
      const gateQuestion = gateQuiz.questions[0]!;
      await tx.quizAttempt.upsert({
        where: { quizId_studentId: { quizId: gateQuiz.id, studentId: MONA_TAREK!.id } },
        update: {
          answers: [{ questionId: gateQuestion.id, answer: gateQuestion.correctAnswer }],
          score: gateQuestion.points,
          totalPoints: gateQuestion.points,
          status: "GRADED",
        },
        create: {
          id: sid("attempt-mona-gate"),
          quizId: gateQuiz.id,
          studentId: MONA_TAREK!.id,
          answers: [{ questionId: gateQuestion.id, answer: gateQuestion.correctAnswer }],
          score: gateQuestion.points,
          totalPoints: gateQuestion.points,
          status: "GRADED",
          startedAt: daysAgo(6),
          completedAt: daysAgo(6),
        },
      });

      // Second attempt on the chapter-2 quiz (has an essay question) — left
      // COMPLETED with no score yet, matching the real "awaiting essay grading"
      // state instead of a fully-graded one.
      const analysisQuiz = chemQuizzes.find((q) => q.chapterId === CHEM_CH2_ID)!;
      const analysisAnswers = analysisQuiz.questions.map((q) => ({
        questionId: q.id,
        answer: q.type === "ESSAY" ? "المعايرة تعتمد على معرفة تركيز محلول قياسي." : (q.correctAnswer ?? ""),
      }));
      await tx.quizAttempt.upsert({
        where: { quizId_studentId: { quizId: analysisQuiz.id, studentId: MONA_TAREK!.id } },
        update: { answers: analysisAnswers, status: "COMPLETED", totalPoints: analysisQuiz.questions.reduce((s, q) => s + q.points, 0) },
        create: {
          id: sid("attempt-mona-analysis"),
          quizId: analysisQuiz.id,
          studentId: MONA_TAREK!.id,
          answers: analysisAnswers,
          status: "COMPLETED",
          totalPoints: analysisQuiz.questions.reduce((s, q) => s + q.points, 0),
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
        },
      });

      // Nour Ibrahim: PASS case for manual verification — real, non-100%
      // percentage (2/3 points = 67%) on a quiz she's actually enrolled in
      // (chapter-1's own quiz, passingScore 50 → 67% passes).
      const nourAttemptAnswers = [
        { questionId: QUIZ_MATTER_STRUCTURE.questions[0]!.id, answer: QUIZ_MATTER_STRUCTURE.questions[0]!.correctAnswer },
        { questionId: QUIZ_MATTER_STRUCTURE.questions[1]!.id, answer: TF_TRUE }, // wrong (correct is TF_FALSE)
      ];
      const nourTotalPoints = QUIZ_MATTER_STRUCTURE.questions.reduce((s, q) => s + q.points, 0);
      await tx.quizAttempt.upsert({
        where: { quizId_studentId: { quizId: QUIZ_MATTER_STRUCTURE.id, studentId: NOUR_IBRAHIM!.id } },
        update: { answers: nourAttemptAnswers, status: "GRADED", score: 2, totalPoints: nourTotalPoints },
        create: {
          id: sid("attempt-nour-matter"),
          quizId: QUIZ_MATTER_STRUCTURE.id,
          studentId: NOUR_IBRAHIM!.id,
          answers: nourAttemptAnswers,
          status: "GRADED",
          score: 2,
          totalPoints: nourTotalPoints,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
        },
      });

      // Youssef Hassan: FAIL case for manual verification — real percentage
      // (1/3 points = 33%) on the chapter he's enrolled/PROMO-enrolled in,
      // below its passingScore of 50 → fails.
      const youssefAttemptAnswers = [
        { questionId: QUIZ_CHEMICAL_BONDING.questions[0]!.id, answer: "الرابطة الفلزية" }, // wrong (correct is الرابطة الأيونية)
        { questionId: QUIZ_CHEMICAL_BONDING.questions[1]!.id, answer: QUIZ_CHEMICAL_BONDING.questions[1]!.correctAnswer },
      ];
      const youssefTotalPoints = QUIZ_CHEMICAL_BONDING.questions.reduce((s, q) => s + q.points, 0);
      await tx.quizAttempt.upsert({
        where: { quizId_studentId: { quizId: QUIZ_CHEMICAL_BONDING.id, studentId: YOUSSEF_HASSAN!.id } },
        update: { answers: youssefAttemptAnswers, status: "GRADED", score: 1, totalPoints: youssefTotalPoints },
        create: {
          id: sid("attempt-youssef-bonding"),
          quizId: QUIZ_CHEMICAL_BONDING.id,
          studentId: YOUSSEF_HASSAN!.id,
          answers: youssefAttemptAnswers,
          status: "GRADED",
          score: 1,
          totalPoints: youssefTotalPoints,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
        },
      });

      // 14. Teacher subscription (Ahmed Sami on the PRO plan).
      const proPlan = await tx.teacherPlan.findUnique({ where: { code: "PRO" } });
      if (proPlan) {
        await tx.teacherSubscription.upsert({
          where: { id: sid("sub-ahmed-pro") },
          update: {
            teacherId: TEACHER_CHEMISTRY.id,
            planId: proPlan.id,
            status: "ACTIVE",
            currentPeriodEnd: daysFromNow(20),
          },
          create: {
            id: sid("sub-ahmed-pro"),
            teacherId: TEACHER_CHEMISTRY.id,
            planId: proPlan.id,
            status: "ACTIVE",
            startedAt: daysAgo(10),
            currentPeriodStart: daysAgo(10),
            currentPeriodEnd: daysFromNow(20),
          },
        });
      }
    },
    { timeout: 30_000 },
  );
}

async function logSeedCounts(): Promise<void> {
  const allEmails = [
    ADMIN.email,
    TEACHER_CHEMISTRY.email,
    TEACHER_PHYSICS.email,
    TEACHER_PENDING.email,
    ...STUDENTS.map((s) => s.email),
  ];
  const [users, stages, chapters, lessons, quizzes, enrollments, promoCodes] = await Promise.all([
    prisma.user.count({ where: { email: { in: allEmails } } }),
    prisma.stage.count({ where: { id: { in: STAGES.map((s) => s.id) } } }),
    prisma.chapter.count({
      where: { id: { in: [...CUSTOM_CHAPTERS.map((c) => c.id), ...CHEMISTRY_CHAPTER_DEFS.map((c) => c.id)] } },
    }),
    prisma.lesson.count({
      where: {
        chapterId: {
          in: [...CUSTOM_CHAPTERS.map((c) => c.id), ...CHEMISTRY_CHAPTER_DEFS.map((c) => c.id)],
        },
      },
    }),
    prisma.quiz.count({
      where: {
        id: {
          in: [
            ...CUSTOM_QUIZZES.map((q) => q.id),
            ...buildChemistryQuizCatalog().map((q) => q.id),
            QUIZ_MULTI_CHAPTER_REVIEW.id,
            QUIZ_FULL_CURRICULUM_FINAL.id,
          ],
        },
      },
    }),
    prisma.enrollment.count({ where: { studentId: { in: STUDENTS.map((s) => s.id) } } }),
    prisma.platformPromoCode.count({
      where: { code: { in: [PROMO_ACTIVE.code, PROMO_EXPIRED.code, PROMO_DISABLED.code] } },
    }),
  ]);

  logger.info("realistic_seed_complete", {
    counts: { users, stages, chapters, lessons, quizzes, enrollments, promoCodes },
    admin: { email: ADMIN.email, password: SEED_SHARED_PASSWORD },
    teachers: [
      { email: TEACHER_CHEMISTRY.email, name: TEACHER_CHEMISTRY.fullName, subject: TEACHER_CHEMISTRY.subject },
      { email: TEACHER_PHYSICS.email, name: TEACHER_PHYSICS.fullName, subject: TEACHER_PHYSICS.subject },
      { email: TEACHER_PENDING.email, name: TEACHER_PENDING.fullName, state: "PENDING_REVIEW" },
    ],
    students: STUDENTS.map((s) => ({ email: s.email, name: s.fullName, emailVerified: s.emailVerified })),
    password: SEED_SHARED_PASSWORD,
  });
}

async function main(): Promise<void> {
  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    productionFlag:
      process.env.ALLOW_PRODUCTION_SEED === "true" ? undefined : process.env.NODE_ENV,
  });

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Seed aborted: NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=true to override.");
  }

  logger.info("seed_started", { environment: process.env.NODE_ENV ?? "development", databaseHost: host });

  await seedAll();
  // Self-contained quiz-unlock-by-lesson-completion QA scenario (own emails
  // under @fahimni.local, own teacher+5 students) — preserved unchanged.
  await seedQuizUnlockScenario();

  await logSeedCounts();

  logger.info("seed_completed", { status: "success" });
}

main()
  .catch((e) => {
    logger.error("seed_failed", { message: e instanceof Error ? e.message : String(e) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
