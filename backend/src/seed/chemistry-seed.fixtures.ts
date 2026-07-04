import type { Prisma } from "../generated/prisma/client.js";
import {
  assertValidSeedUuid,
  seedId,
} from "./chemistry-ids.js";

export { ALL_CHEMISTRY_QUIZ_IDS as ALL_QUIZ_IDS } from "./chemistry-quiz-catalog.js";

export const CHEMISTRY_CHAPTER_COUNT = 5;

export interface SeedQuestion {
  id: string;
  quizId: string;
  type: "MCQ" | "TRUE_FALSE" | "ESSAY";
  text: string;
  options: Prisma.InputJsonValue;
  correctAnswer: string | null;
  explanation: string;
  sortOrder: number;
  points: number;
}

export function buildQuestions(quizId: string, ci: number): SeedQuestion[] {
  const chNum = ci + 1;
  const themes = [
    {
      mcq: [
        "ما العدد الأكسجيني للحديد في أكسيد الحديد III؟",
        ["+2", "+3", "+4", "0"],
        "+3",
        "في Fe2O3 يكون الحديد في حالة تأكسد +3.",
      ],
      tf: [
        "العناصر الانتقالية تكوّن أيونات ملوّنة.",
        "صح",
        "بسبب انتقال الإلكترونات بين مستويات d.",
      ],
      essay: [
        "اشرح سبب تعدد حالات التأكسد في العناصر الانتقالية.",
        "تقارب طاقات مستويات (n-1)d و ns يسمح بفقد أعداد مختلفة من الإلكترونات.",
      ],
    },
    {
      mcq: [
        "أي كاشف يُستخدم للكشف عن أيون الكلوريد؟",
        ["نترات الفضة", "هيدروكسيد الصوديوم", "كلوريد الباريوم", "ماء الجير"],
        "نترات الفضة",
        "يتكوّن راسب أبيض من AgCl.",
      ],
      tf: [
        "المعايرة طريقة في التحليل الكمي.",
        "صح",
        "تُستخدم لتحديد تركيز محلول مجهول.",
      ],
      essay: [
        "وضّح خطوات حساب تركيز حمض من نتائج المعايرة.",
        "باستخدام عدد المولات = التركيز × الحجم ونسب التفاعل المتكافئة.",
      ],
    },
    {
      mcq: [
        "عند زيادة الضغط على تفاعل غازي، يتجه الاتزان نحو:",
        [
          "الجهة الأقل في عدد المولات الغازية",
          "الجهة الأكثر في المولات",
          "لا يتأثر",
          "يتوقف التفاعل",
        ],
        "الجهة الأقل في عدد المولات الغازية",
        "حسب مبدأ لوشاتلييه.",
      ],
      tf: [
        "ثابت الاتزان يتغير بتغير التركيز فقط.",
        "خطأ",
        "ثابت الاتزان يتغير بتغير درجة الحرارة وليس التركيز.",
      ],
      essay: [
        "اذكر العوامل المؤثرة على موضع الاتزان الكيميائي.",
        "التركيز والضغط ودرجة الحرارة (والعامل الحفّاز لا يغيّر الموضع).",
      ],
    },
    {
      mcq: [
        "في الخلية الجلفانية يحدث عند المصعد (الأنود):",
        ["تأكسد", "اختزال", "لا تفاعل", "ترسيب"],
        "تأكسد",
        "الأنود هو قطب التأكسد.",
      ],
      tf: [
        "قوانين فاراداي تربط كتلة المادة المترسبة بكمية الكهرباء.",
        "صح",
        "الكتلة تتناسب طرديًا مع الشحنة المارة.",
      ],
      essay: [
        "قارن بين الخلية الجلفانية وخلية التحليل الكهربي من حيث الطاقة.",
        "الجلفانية تحوّل كيميائية←كهربية تلقائيًا، والتحليل الكهربي يحتاج طاقة كهربية لإحداث تفاعل غير تلقائي.",
      ],
    },
    {
      mcq: [
        "أي المركبات التالية كحول؟",
        ["CH3OH", "CH4", "CO2", "NaCl"],
        "CH3OH",
        "الميثانول كحول يحتوي مجموعة OH.",
      ],
      tf: [
        "البوليمرات جزيئات كبيرة تتكوّن من وحدات متكررة.",
        "صح",
        "تنتج من بلمرة المونومرات.",
      ],
      essay: [
        "اشرح الفرق بين الكحولات والأحماض الكربوكسيلية في المجموعة الوظيفية.",
        "الكحول مجموعته OH بينما الحمض الكربوكسيلي مجموعته COOH.",
      ],
    },
  ];
  const t = themes[ci]!;
  const questions: SeedQuestion[] = [
    {
      id: seedId(`quiz-ch${chNum}-question-01`),
      quizId,
      type: "MCQ",
      text: t.mcq[0] as string,
      options: t.mcq[1] as unknown as Prisma.InputJsonValue,
      correctAnswer: t.mcq[2] as string,
      explanation: t.mcq[3] as string,
      sortOrder: 1,
      points: 2,
    },
    {
      id: seedId(`quiz-ch${chNum}-question-02`),
      quizId,
      type: "TRUE_FALSE",
      text: t.tf[0]!,
      options: ["صح", "خطأ"] as unknown as Prisma.InputJsonValue,
      correctAnswer: t.tf[1]!,
      explanation: t.tf[2]!,
      sortOrder: 2,
      points: 1,
    },
    {
      id: seedId(`quiz-ch${chNum}-question-03`),
      quizId,
      type: "ESSAY",
      text: t.essay[0]!,
      options: [] as unknown as Prisma.InputJsonValue,
      correctAnswer: null,
      explanation: t.essay[1]!,
      sortOrder: 3,
      points: 3,
    },
  ];

  for (const q of questions) {
    assertValidSeedUuid(q.id, `question-${chNum}-${q.sortOrder}`);
    assertValidSeedUuid(q.quizId, `quiz-ch${chNum}`);
  }

  return questions;
}
