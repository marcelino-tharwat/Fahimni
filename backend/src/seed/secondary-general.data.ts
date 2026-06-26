/**
 * STORY-45 local seed dataset — Egyptian General Secondary Education
 * (المرحلة الثانوية العامة).
 *
 * Pure, deterministic data only. No database access, no secrets. This module is
 * type-checked and unit-tested; `prisma/seed.ts` consumes it to upsert the local
 * development dataset and to emit the Postman manifest/environment.
 *
 * ID scheme (stable across runs so the seed is idempotent and the existing local
 * database matches without duplicates):
 *   users    : f450000N-0001-4001-8001-000000000001
 *   stages   : f45000SS-0001-4001-8001-000000000001
 *   chapters : f4500CCC-0001-4001-8001-000000000001  (chapter == its lesson #1 id)
 *   lessons  : f4500CCC-0001-4001-8001-0000000000NN
 */

export const SEED_VERSION = "secondary-general-v1";

/** Expand a short base segment into the project's deterministic UUID shape. */
export function fullId(base: string, n = 1): string {
  return `${base}-0001-4001-8001-${String(n).padStart(12, "0")}`;
}

export interface SeedAccount {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  profileId: string;
  subject?: string;
}

export const ACCOUNTS: {
  teacher1: SeedAccount;
  student: SeedAccount;
  teacher2: SeedAccount;
} = {
  teacher1: {
    id: fullId("f4500001"),
    email: "story45.teacher1@local.test",
    fullName: "معلّم الرحلة الأول",
    mobile: "01000000451",
    subject: "الرياضيات والعلوم",
    profileId: fullId("f4500001", 161),
  },
  student: {
    id: fullId("f4500002"),
    email: "story45.student@local.test",
    fullName: "طالب الرحلة",
    mobile: "01000000452",
    profileId: fullId("f4500002", 162),
  },
  teacher2: {
    id: fullId("f4500003"),
    email: "story45.teacher2@local.test",
    fullName: "معلّم الرحلة الثاني",
    mobile: "01000000453",
    subject: "الفيزياء",
    profileId: fullId("f4500003", 163),
  },
};

export interface SeedLesson {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  sortOrder: number;
  /** Educational source text used for RAG indexing (AI-ready fixtures only). */
  text: string;
}

export interface SeedChapter {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  stageId: string;
  lessons: SeedLesson[];
}

export interface SeedStage {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

/** Build a 3-lesson chapter from a base + lesson tuples. */
function chapter(
  base: string,
  stageId: string,
  name: string,
  description: string,
  sortOrder: number,
  lessons: Array<{ title: string; description: string; text?: string }>,
): SeedChapter {
  return {
    id: fullId(base),
    name,
    description,
    sortOrder,
    stageId,
    lessons: lessons.map((l, i) => ({
      id: fullId(base, i + 1),
      title: l.title,
      description: l.description,
      durationMinutes: 25 + i * 5,
      sortOrder: i + 1,
      text:
        l.text ??
        `${l.title}: ${l.description} يتناول هذا الدرس المفاهيم الأساسية ضمن ${name} للمرحلة الثانوية العامة، مع أمثلة وتطبيقات تساعد الطالب على الفهم والتدريب.`,
    })),
  };
}

// ── Stage IDs ────────────────────────────────────────────────────────────
const STAGE_G1 = fullId("f4500010"); // الصف الأول الثانوي (Teacher 1)
const STAGE_G2 = fullId("f4500011"); // الصف الثاني الثانوي (Teacher 1)
const STAGE_G3 = fullId("f4500012"); // الصف الثالث الثانوي (Teacher 1)
const STAGE_T2 = fullId("f4500020"); // الصف الأول الثانوي (Teacher 2)

export const TEACHER1_STAGES: SeedStage[] = [
  {
    id: STAGE_G1,
    name: "الصف الأول الثانوي",
    description:
      "المرحلة الثانوية العامة — الصف الأول الثانوي: أساسيات الرياضيات والفيزياء والكيمياء.",
    sortOrder: 1,
  },
  {
    id: STAGE_G2,
    name: "الصف الثاني الثانوي",
    description:
      "المرحلة الثانوية العامة — الصف الثاني الثانوي: تعميق المفاهيم العلمية والرياضية.",
    sortOrder: 2,
  },
  {
    id: STAGE_G3,
    name: "الصف الثالث الثانوي",
    description:
      "المرحلة الثانوية العامة — الصف الثالث الثانوي: مراجعة وتعمّق استعدادًا للثانوية العامة.",
    sortOrder: 3,
  },
];

export const TEACHER2_STAGE: SeedStage = {
  id: STAGE_T2,
  name: "الصف الأول الثانوي",
  description:
    "المرحلة الثانوية العامة — محتوى معلّم آخر لاختبارات ملكية المحتوى.",
  sortOrder: 1,
};

// ── Rich educational text for the successful (RAG-indexed) chapter ─────────
const LINEAR_FN_TEXT = [
  `الدالة الخطية هي علاقة رياضية تربط بين متغيرين بحيث تكون الصورة العامة لها د(س) = أ س + ب، حيث أ و ب عددان حقيقيان ثابتان، وتُسمى أ ميل الدالة بينما يمثل ب القيمة الابتدائية أو الجزء المقطوع من المحور الصادي. وتُعد الدالة الخطية من أبسط أنواع الدوال وأكثرها استخدامًا في وصف الظواهر التي يتغير فيها المقدار بمعدل ثابت.`,
  `يكون التمثيل البياني للدالة الخطية دائمًا خطًا مستقيمًا في المستوى الإحداثي. فعندما نعطي المتغير س قيمًا مختلفة نحصل على قيم مقابلة للمتغير ص، وعند توقيع هذه النقاط وتوصيلها نحصل على خط مستقيم. وكلما زادت قيمة الميل أ زاد ميل الخط واقترب من الرأسية، وإذا كان الميل موجبًا كان الخط صاعدًا، وإذا كان سالبًا كان الخط هابطًا.`,
  `إذا كان الميل أ يساوي صفرًا تتحول الدالة إلى دالة ثابتة صورتها د(س) = ب، ويكون تمثيلها البياني خطًا أفقيًا موازيًا لمحور السينات. أما إذا كان ب يساوي صفرًا فإن الخط يمر بنقطة الأصل، وتصبح العلاقة بين س و ص علاقة تناسب طردي.`,
  `تُستخدم الدالة الخطية في حياتنا اليومية في مواقف كثيرة، مثل حساب أجرة سيارة تتكون من مبلغ ثابت عند الركوب يضاف إليه مبلغ يتناسب مع المسافة، أو حساب فاتورة تتضمن رسمًا ثابتًا واستهلاكًا متغيرًا. وفي كل هذه الحالات يمثل الجزء الثابت القيمة ب ويمثل معدل التغير الميل أ.`,
].join("\n\n");

const SLOPE_TEXT = [
  `ميل الخط المستقيم مقياس لمدى انحدار الخط، ويُعرَّف بأنه النسبة بين مقدار التغير الرأسي في قيم ص ومقدار التغير الأفقي في قيم س بين أي نقطتين على الخط. ويُحسب الميل من العلاقة: الميل = (ص٢ − ص١) ÷ (س٢ − س١)، بشرط ألا يكون المقام صفرًا.`,
  `يدل الميل الموجب على أن الخط صاعد من اليسار إلى اليمين، أي أن قيمة ص تزداد بزيادة س، بينما يدل الميل السالب على أن الخط هابط. أما الميل الذي يساوي صفرًا فيعني أن الخط أفقي ولا تتغير قيمة ص، والخط الرأسي ليس له ميل معرَّف لأن التغير الأفقي يساوي صفرًا.`,
  `الجزء المقطوع من المحور الصادي هو قيمة ص عند النقطة التي يقطع فيها الخط محور الصادات، أي عندما تكون س = صفر، وهو يساوي الثابت ب في صورة الدالة الخطية. وبمعرفة الميل والجزء المقطوع يمكن كتابة معادلة الخط المستقيم مباشرة ورسمه بدقة.`,
  `لرسم خط مستقيم بمعلومية الميل والجزء المقطوع نبدأ بتوقيع نقطة التقاطع مع المحور الصادي عند (٠، ب)، ثم نستخدم الميل لتحديد نقطة ثانية بالانتقال خطوة أفقية وما يقابلها رأسيًا، وبتوصيل النقطتين نحصل على الخط المطلوب.`,
].join("\n\n");

const GRAPH_TEXT = [
  `التمثيل البياني للدالة الخطية يعني ترجمة العلاقة الجبرية د(س) = أ س + ب إلى صورة هندسية في المستوى الإحداثي. ويكفي تحديد نقطتين تحققان المعادلة ثم توصيلهما بخط مستقيم للحصول على التمثيل الكامل للدالة.`,
  `من الطرق الشائعة للرسم اختيار قيمتين مناسبتين للمتغير س، ثم حساب قيمتي ص المقابلتين باستخدام المعادلة، وتكوين جدول قيم بسيط. وبعد توقيع النقطتين في المستوى نوصل بينهما ونمد الخط في الاتجاهين.`,
  `يمكن قراءة خصائص الدالة من تمثيلها البياني مباشرة؛ فنقطة تقاطع الخط مع المحور الصادي تعطي الثابت ب، وانحدار الخط يعبّر عن الميل أ، ونقطة تقاطعه مع محور السينات تمثل حل المعادلة أ س + ب = صفر.`,
  `يساعد التمثيل البياني على المقارنة بين أكثر من دالة خطية في الوقت نفسه؛ فالخطوط المتوازية لها الميل نفسه وتختلف في الجزء المقطوع، بينما الخطوط التي تتقاطع تختلف في الميل، ونقطة تقاطعها تمثل الحل المشترك للمعادلتين.`,
].join("\n\n");

// ── Teacher 1 chapters ────────────────────────────────────────────────────
export const TEACHER1_CHAPTERS: SeedChapter[] = [
  // Stage 1 — الصف الأول الثانوي
  chapter("f4500100", STAGE_G1, "الرياضيات — الدوال الخطية", "دراسة الدالة الخطية وميلها وتمثيلها البياني.", 1, [
    {
      title: "مفهوم الدالة الخطية",
      description: "تعريف الدالة الخطية وصورتها العامة ومكوناتها.",
      text: LINEAR_FN_TEXT,
    },
    {
      title: "الميل والجزء المقطوع",
      description: "حساب الميل والجزء المقطوع وتفسيرهما هندسيًا.",
      text: SLOPE_TEXT,
    },
    {
      title: "التمثيل البياني للدالة الخطية",
      description: "رسم الخط المستقيم وقراءة خصائص الدالة منه.",
      text: GRAPH_TEXT,
    },
  ]),
  chapter("f4500101", STAGE_G1, "الرياضيات — المعادلات التربيعية", "المعادلات من الدرجة الثانية وطرق حلها.", 2, [
    { title: "مفهوم المعادلة التربيعية", description: "الصورة العامة للمعادلة التربيعية ومميزها." },
    { title: "التحليل إلى عوامل", description: "حل المعادلة التربيعية بالتحليل إلى عوامل." },
    { title: "القانون العام", description: "استخدام القانون العام لإيجاد جذور المعادلة." },
  ]),
  chapter("f4500102", STAGE_G1, "الفيزياء — الحركة في خط مستقيم", "وصف الحركة في بعد واحد.", 3, [
    { title: "المسافة والإزاحة", description: "الفرق بين الكمية القياسية والكمية المتجهة." },
    { title: "السرعة والسرعة المتجهة", description: "حساب السرعة المتوسطة والسرعة المتجهة." },
    { title: "العجلة", description: "مفهوم العجلة ومعادلات الحركة بعجلة منتظمة." },
  ]),
  chapter("f4500103", STAGE_G1, "الكيمياء — بنية الذرة", "تركيب الذرة وجسيماتها.", 4, [
    { title: "مكونات الذرة", description: "البروتونات والنيوترونات والإلكترونات." },
    { title: "العدد الذري والعدد الكتلي", description: "تعريف العدد الذري والكتلي والنظائر." },
    { title: "التوزيع الإلكتروني", description: "توزيع الإلكترونات على المستويات." },
  ]),
  // Stage 2 — الصف الثاني الثانوي
  chapter("f4500110", STAGE_G2, "الرياضيات — حساب المثلثات", "النسب المثلثية والدائرة المثلثية.", 1, [
    { title: "النسب المثلثية", description: "الجيب وجيب التمام والظل." },
    { title: "الدائرة المثلثية", description: "تعريف النسب على دائرة الوحدة." },
    { title: "المتطابقات المثلثية", description: "المتطابقات الأساسية وتطبيقاتها." },
  ]),
  chapter("f4500111", STAGE_G2, "الفيزياء — الموجات والصوت", "خصائص الموجات وانتشار الصوت.", 2, [
    { title: "خصائص الموجات", description: "الطول الموجي والتردد والسعة." },
    { title: "أنواع الموجات", description: "الموجات الطولية والمستعرضة." },
    { title: "الصوت وانتشاره", description: "انتشار الصوت في الأوساط المختلفة." },
  ]),
  chapter("f4500112", STAGE_G2, "الكيمياء — الروابط الكيميائية", "أنواع الروابط بين الذرات.", 3, [
    { title: "الرابطة الأيونية", description: "تكوّن الرابطة الأيونية بانتقال الإلكترونات." },
    { title: "الرابطة التساهمية", description: "المشاركة الإلكترونية في الرابطة التساهمية." },
    { title: "الرابطة الفلزية", description: "بحر الإلكترونات في الفلزات." },
  ]),
  chapter("f4500113", STAGE_G2, "الأحياء — النقل في الكائنات الحية", "آليات النقل داخل الكائن الحي.", 4, [
    { title: "النقل عبر الغشاء", description: "النقل النشط والسلبي عبر الغشاء الخلوي." },
    { title: "الجهاز الدوري", description: "تركيب ووظيفة الجهاز الدوري." },
    { title: "التنفس الخلوي", description: "إنتاج الطاقة داخل الخلية." },
  ]),
  // Stage 3 — الصف الثالث الثانوي
  chapter("f4500120", STAGE_G3, "الرياضيات — التفاضل", "النهايات والاشتقاق وتطبيقاته.", 1, [
    { title: "النهايات", description: "مفهوم النهاية وطرق حسابها." },
    { title: "المشتقة الأولى", description: "قواعد الاشتقاق الأساسية." },
    { title: "تطبيقات التفاضل", description: "القيم العظمى والصغرى والمماس." },
  ]),
  chapter("f4500121", STAGE_G3, "الكيمياء — الاتزان الكيميائي", "الاتزان وثابته وعوامل تأثيره.", 2, [
    { title: "مفهوم الاتزان", description: "الاتزان الديناميكي في التفاعلات." },
    { title: "ثابت الاتزان", description: "حساب ثابت الاتزان وتفسيره." },
    { title: "مبدأ لو شاتيليه", description: "تأثير العوامل على موضع الاتزان." },
  ]),
  chapter("f4500122", STAGE_G3, "الفيزياء — التيار الكهربي", "التيار والمقاومة والدوائر.", 3, [
    { title: "التيار والفرق الجهدي", description: "تعريف التيار وفرق الجهد." },
    { title: "قانون أوم", description: "العلاقة بين الجهد والتيار والمقاومة." },
    { title: "توصيل المقاومات", description: "التوصيل على التوالي والتوازي." },
  ]),
  chapter("f4500123", STAGE_G3, "الأحياء — الوراثة", "قوانين الوراثة والمادة الوراثية.", 4, [
    { title: "قوانين مندل", description: "قوانين مندل في الوراثة." },
    { title: "الكروموسومات", description: "تركيب الكروموسومات ودورها." },
    { title: "الطفرات", description: "أنواع الطفرات وأثرها." },
  ]),
];

// ── Teacher 2 chapter (ownership fixture) ─────────────────────────────────
export const TEACHER2_CHAPTERS: SeedChapter[] = [
  {
    id: fullId("f4500200"),
    name: "الفيزياء — خواص المادة",
    description: "دراسة بعض الخواص الفيزيائية للمادة.",
    sortOrder: 1,
    stageId: STAGE_T2,
    lessons: [
      {
        id: fullId("f4500200", 1),
        title: "الكثافة",
        description: "مفهوم الكثافة وحسابها.",
        durationMinutes: 25,
        sortOrder: 1,
        text: "الكثافة خاصية فيزيائية تعبّر عن مقدار الكتلة في وحدة الحجوم، وتُحسب بقسمة الكتلة على الحجم.",
      },
      {
        id: fullId("f4500200", 2),
        title: "الضغط",
        description: "مفهوم الضغط وتطبيقاته.",
        durationMinutes: 30,
        sortOrder: 2,
        text: "الضغط هو القوة المؤثرة عموديًا على وحدة المساحات، وله تطبيقات في السوائل والغازات.",
      },
    ],
  },
];

// ── STORY-45 deterministic fixtures ───────────────────────────────────────
export const FIXTURES = {
  /** Successful generation chapter (RAG-indexed) and its lessons. */
  stageId: STAGE_G1,
  chapterId: fullId("f4500100"),
  lessonId1: fullId("f4500100", 1),
  lessonId2: fullId("f4500100", 2),
  lessonId3: fullId("f4500100", 3),
  /** Lessons that must be indexed for the AI-ready fixture. */
  indexLessonIds: [
    fullId("f4500100", 1),
    fullId("f4500100", 2),
    fullId("f4500100", 3),
  ],
  /** Intentionally unindexed chapter (expected 422). */
  unindexedChapterId: fullId("f4500101"),
  /** Teacher 2 ownership fixture (expected safe 403/404). */
  otherTeacherChapterId: fullId("f4500200"),
  otherTeacherLessonId: fullId("f4500200", 1),
  /** Non-existent UUID for the 404 test. */
  missingUuid: "00000000-0000-4000-8000-000000000000",
  expectedQuestionCount: 5,
} as const;

/** Educational-stage keywords that must NOT appear (e.g. preparatory stages). */
export const FORBIDDEN_STAGE_KEYWORDS = ["الإعدادي", "الابتدائي"];
