export interface ChapterTemplate {
  stageIndex: number;
  subject: string;
  name: string;
  description: string;
  price: number | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  lessons: { title: string; description: string; durationMinutes: number }[];
}

export interface QuizTemplate {
  chapterIndex: number;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: "PUBLISHED" | "DRAFT";
  questions: {
    type: "MCQ" | "TRUE_FALSE" | "ESSAY";
    text: string;
    options: string[];
    correctAnswer: string | null;
    explanation: string;
    points: number;
  }[];
}

export const EGYPTIAN_SUBJECTS = [
  "الكيمياء",
  "الفيزياء",
  "الأحياء",
  "الرياضيات",
  "اللغة العربية",
  "اللغة الإنجليزية",
  "الجيولوجيا",
  "التربية الإسلامية",
  "التاريخ",
  "الجغرافيا",
  "الفلسفة",
  "العلوم",
] as const;

export const CHAPTER_TEMPLATES: ChapterTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════
  // STAGE 0 — الصف الأول الثانوي
  // ═══════════════════════════════════════════════════════════════════
  {
    stageIndex: 0,
    subject: "الكيمياء",
    name: "مقدمة في تركيب المادة",
    description: "مدخل إلى حالات المادة وتركيب الذرة والجدول الدوري الحديث، تمهيدًا لمنهج الكيمياء في المرحلة الثانوية.",
    price: 40,
    term: "FIRST_TERM",
    lessons: [
      { title: "حالات المادة وخواصها", description: "حالات المادة الثلاث (صلبة، سائلة، غازية) وخواص كل حالة، والتغيرات بين الحالات.", durationMinutes: 20 },
      { title: "تركيب الذرة", description: "مكونات الذرة (البروتونات والنيوترونات والإلكترونات)، والعدد الذري والعدد الكتلي، ومفهوم النظائر.", durationMinutes: 25 },
      { title: "الجدول الدوري الحديث", description: "تنظيم الجدول الدوري في مجموعات ودورات، والعلاقة بين موضع العنصر وخواصه.", durationMinutes: 25 },
      { title: "الروابط الكيميائية", description: "أنواع الروابط الكيميائية: الأيونية والتساهمية والفلزية، وعلاقتها بخواص المركبات.", durationMinutes: 22 },
      { title: "الوحدات الكيميائية الأساسية", description: "المول والكتلة المولية وحسابات التركيز الكيميائية الأساسية.", durationMinutes: 28 },
    ],
  },
  {
    stageIndex: 0,
    subject: "الفيزياء",
    name: "الكميات الفيزيائية والقياس",
    description: "أساسيات القياس في الفيزياء: الفرق بين الكميات القياسية والمتجهة، ووحدات القياس الدولية.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "الكميات القياسية والمتجهة", description: "الفرق بين الكمية القياسية (لها مقدار فقط) والكمية المتجهة (لها مقدار واتجاه).", durationMinutes: 20 },
      { title: "وحدات القياس الدولية", description: "النظام الدولي للوحدات (SI): الوحدات الأساسية والunits المشتقة وأهمية توحيد وحدات القياس.", durationMinutes: 20 },
      { title: "الأخطاء القياسية", description: "أنواع الأخطاء القياسية وكيفية حسابها وتقليلها في التجارب الفيزيائية.", durationMinutes: 22 },
      { title: "التحويلات بين الوحدات", description: "طرق تحويل وحدات القياس بين المختلفة باستخدام عوامل التحويل.", durationMinutes: 18 },
      { title: "الرسوم البيانية في الفيزياء", description: "تمثيل العلاقات الفيزيائية بالرسوم البيانية واستخلاص المعلومات منها.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 0,
    subject: "الأحياء",
    name: "الخلية وحدة الحياة",
    description: "دراسة الخلية كوحدة أساسية في بناء الكائنات الحية، وتركيبها الداخلي ووظائفها.",
    price: 35,
    term: "FIRST_TERM",
    lessons: [
      { title: "مقدمة عن الخلية", description: "تعريف الخلية وأهميتها، الفرق بين الخلية الحيوانية والنباتية، تاريخ اكتشاف الخلية.", durationMinutes: 20 },
      { title: "غشاء الخلية", description: "تركيب غشاء الخلية ووظائفه، نموذج الموزع الفسيح، انتقال المواد عبر الغشاء.", durationMinutes: 25 },
      { title: "السيتوبلازم والأعضاء الخلوية", description: "دراسة السيتوبلازم والأعضاء الخلوية: الميتوكوندريا والشبكة الإندوبلازمية وجهاز جولجي.", durationMinutes: 28 },
      { title: "النواة الخلوية", description: "تركيب النواة ووظيفتها في التخزين والتعبير عن المعلومات الوراثية.", durationMinutes: 22 },
      { title: "الانقسام الخلوي", description: "مراحل الانقسام الخلوي: الانقسام الفتيلي والانقسام المنصّف.", durationMinutes: 30 },
    ],
  },
  {
    stageIndex: 0,
    subject: "الرياضيات",
    name: "الجبر والمتغيرات",
    description: "أساسيات الجبر والتعامل مع المتغيرات والمعادلات الخطية والتراتيبية.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "المتغيرات والتعابير الجبرية", description: "تعريف المتغير وكيفية كتابة التعابير الجبرية وتبسيطها.", durationMinutes: 20 },
      { title: "المعادلات الخطية", description: "حل المعادلات الخطية من 변수 واحد والتحقق من صحة الحل.", durationMinutes: 25 },
      { title: "نظام المعادلات الخطية", description: "حل نظام المعادلات باستخدام طريقة التعويض والطريقة الإضافية.", durationMinutes: 28 },
      { title: "الدوال الخطية", description: "تعريف الدالة الخطية ورسم بيانيها وخصائصها.", durationMinutes: 22 },
      { title: "النسبة المئوية والتناسب", description: "حساب النسب المئوية والتناسب الطردي والعكسي.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 0,
    subject: "اللغة العربية",
    name: "النحو والصرف",
    description: "أساسيات النحو العربي: الإعراب والحكم على أقسام الكلام، والصرف والتصريف.",
    price: 30,
    term: "FIRST_TERM",
    lessons: [
      { title: "أقسام الكلام", description: "الجملة الاسمية والفعلية، أركان كل جملة، التمييز بينها.", durationMinutes: 20 },
      { title: "المبتدأ والخبر", description: "حكم المبتدأ والخبر، شروطهما، ما لا يرفع بالابتداء.", durationMinutes: 22 },
      { title: "الفاعل والمفعول به", description: "حكم الفاعل والمفعول به، أحوالهما، التمييز بينهما.", durationMinutes: 25 },
      { title: "النعت والإضافة", description: "حكم النعت (الصفة) والإضافة وشروط كل منهما.", durationMinutes: 22 },
      { title: "الصرف والتصريف", description: "الميزان الصرفي وتصريف الأسماء والأفعال.", durationMinutes: 24 },
    ],
  },
  {
    stageIndex: 0,
    subject: "اللغة الإنجليزية",
    name: "أساسيات القواعد",
    description: "تعلم قواعد اللغة الإنجليزية الأساسية من أزمنة الأفعال ونوعيات الجمل.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "Parts of Speech", description: "أنواع الكلمات في اللغة الإنجليزية: اسم، فعل، صفة، ظرف، أداة ربط.", durationMinutes: 18 },
      { title: "Present Tenses", description: "الأزمنة الحالية: Present Simple و Present Continuous و Present Perfect.", durationMinutes: 22 },
      { title: "Past Tenses", description: "الأزمنة الماضية: Past Simple و Past Continuous و Past Perfect.", durationMinutes: 25 },
      { title: "Sentence Structure", description: "تركيب الجملة الإيجابية والسلبية والاستفهامية في الإنجليزية.", durationMinutes: 20 },
      { title: "Articles and Prepositions", description: "استخدام أداة التعريف The والتنكير a/an وحروف الجر.", durationMinutes: 18 },
    ],
  },
  {
    stageIndex: 0,
    subject: "الجيولوجيا",
    name: "مكونات الأرض",
    description: "دراسة مكونات كوكب الأرض من باطن إلى سطح: اللب والمانتيا والقشرة الأرضية.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "internal structure of the Earth", description: "طبقات الأرض الداخلية: اللب الداخلي والخارجي والمانتيا والقشرة.", durationMinutes: 22 },
      { title: "أنواع الصخور", description: "الصخور النارية والرسوبية والمتحولة وتشكّلها وخصائصها.", durationMinutes: 25 },
      { title: "الدورة الصخرية", description: "دورة تحوّل الصخور وعلاقتها بالنشاط البركاني والترسيبي.", durationMinutes: 22 },
      { title: "الصخور النارية", description: "تصنيف الصخور النارية إلى نارية بركانية ونارية عميائية وخصائص كل نوع.", durationMinutes: 20 },
      { title: "الصخور الرسوبية", description: "تشكّل الصخور الرسوبية وتصنيفها: ميكانيكية وكيميائية وعضوية.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 0,
    subject: "التربية الإسلامية",
    name: "العقيدة الإسلامية",
    description: "دروس في العقيدة الإسلامية: التوحيد والنبوات والسمات والقدر.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "مفهوم العقيدة الإسلامية", description: "تعريف العقيدة وأركان الإيمان الستة وأهميتها في حياة المسلم.", durationMinutes: 20 },
      { title: "التوحيد وأنواعه", description: "أنواع التوحيد: التوحيد الربوبي والعبادي والأسماء والصفات.", durationMinutes: 25 },
      { title: "النبوة والرسل", description: "مفهوم النبوة ووظائف الرسل وخصائص النبي محمد صلى الله عليه وسلم.", durationMinutes: 22 },
      { title: "اليوم الآخر", description: "علامات الساعة الكبرى والصغرى وأحداث يوم القيامة.", durationMinutes: 28 },
      { title: "القضاء والقدر", description: "مفهوم القضاء والقدر وحكمته وآداب المسلم أمامهما.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 0,
    subject: "التاريخ",
    name: "تاريخ مصر القديم",
    description: "دراسة حضارة مصر القديمة من عصور ما قبل الأسرية إلى العصر البطلمي.",
    price: 25,
    term: "SECOND_TERM",
    lessons: [
      { title: "عصور ما قبل الأسرية", description: "العصر الحجري القديم والحديث في مصر وتطور الحياة الزراعية.", durationMinutes: 22 },
      { title: "عصر الأسر المبكرة", description: "تأسيس الدولة المصرية القديمة وأول ملوك الأسرات.", durationMinutes: 25 },
      { title: "العصر القديم وال moyen", description: "بناء الأهرامات وتطور الإدارة والدين في المملكة القديمة والوسطى.", durationMinutes: 28 },
      { title: "العصر الحديث والمتاخر", description: "إمبراطورية مصر的新 kingdom والثورة الهيكلية وعصر الرعامسة.", durationMinutes: 25 },
      { title: "العصر البطلمي", description: "دخول الإسكندرية وتأسيس الدولة البطلمية وتأثيرها على الثقافة المصرية.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 0,
    subject: "الجغرافيا",
    name: "الغلاف الجوي والمناخ",
    description: "دراسة مكونات الغلاف الجوي وأنواع المناخ وتأثيره على حياة الكائنات الحية.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "مكونات الغلاف الجوي", description: "طبقات الغلاف الجوي وتركيبها الفيزيائي والكيميائي.", durationMinutes: 20 },
      { title: "العناصر المناخية", description: "عناصر المناخ: الحرارة والرطوبة والرياح والأمطار.", durationMinutes: 22 },
      { title: "أنواع المناخ", description: "تصنيف المناخات حسب كوبن وخصائص كل نوع.", durationMinutes: 25 },
      { title: "تأثير المناخ على الإنسان", description: "تأثير المناخ على النشاط البشري من زراعة وسكن ونشاط اقتصادي.", durationMinutes: 22 },
      { title: "التغيرات المناخية", description: "ظاهرة الاحتباس الحراري وأسبابها وتأثيراتها على البيئة.", durationMinutes: 20 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 1 — الصف الثاني الثانوي
  // ═══════════════════════════════════════════════════════════════════
  {
    stageIndex: 1,
    subject: "الكيمياء",
    name: "الروابط الكيميائية",
    description: "أنواع الروابط الكيميائية بين الذرات وكيفية تفسير خواص المركبات في ضوء نوع الرابطة.",
    price: 80,
    term: "FIRST_TERM",
    lessons: [
      { title: "الرابطة الأيونية", description: "تكوّن الرابطة الأيونية بانتقال الإلكترونات وخواص المركبات الأيونية.", durationMinutes: 22 },
      { title: "الرابطة التساهمية", description: "تكوين الرابطة التساهمية بمشاركة أزواج الإلكترونات والروابط الأحادية والثنائية والثلاثية.", durationMinutes: 22 },
      { title: "الأشكال الجزيئية", description: "نظرية رفض الأزواج الإلكترونية (VSEPR) وتحديد الأشكال الجزيئية.", durationMinutes: 25 },
      { title: "الاستقطاب الكيميائي", description: "فروق الكهروسلبية والاستقطاب في الروابط الجزيئية.", durationMinutes: 20 },
      { title: "الروابط الأيونية التساهمية", description: "الخواطئ الكيميائية ونوعية الروابط في المركبات الكيميائية المختلفة.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 1,
    subject: "الفيزياء",
    name: "القوى والحركة",
    description: "دراسة القوى المؤثرة على الأجسام وقانون نيوتن الثاني وتطبيقاته العملية.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "قانون نيوتن الأول", description: "مبدأ القصور الذاتي وقانون العطالة وتطبيقاته اليومية.", durationMinutes: 20 },
      { title: "قانون نيوتن الثاني", description: "علاقة القوة بالكتلة والتسارع وحسابات الحركة الخطية المستقيمة.", durationMinutes: 25 },
      { title: "قانون نيوتن الثالث", description: "فعل ورد فعل وتطبيقاته في الحياة اليومية والفيزياء.", durationMinutes: 22 },
      { title: "قوى الاحتكاك", description: "أنواع الاحتكاك: السكوني والحركي وحساب قيمتهما.", durationMinutes: 25 },
      { title: "حركة الميلان", description: "تحليل قوى الأجسام على أسطح مائلة وحساب التسارع.", durationMinutes: 28 },
    ],
  },
  {
    stageIndex: 1,
    subject: "الأحياء",
    name: "الوراثة والمعلومات الوراثية",
    description: "دراسة قوانين مندل والوراثة الجزيئية وكيفية انتقال الصفات من جيل إلى آخر.",
    price: 55,
    term: "SECOND_TERM",
    lessons: [
      { title: "قوانين مندل", description: "القانون الأول (التوزيع المستقل) والقانون الثاني (التناسب) وتجربة البازلاء.", durationMinutes: 25 },
      { title: "الوراثة المتعاكسة", description: "التنبيغ والتنائي والوراثة المتعاكسة وتحديد أنماط التظاهر.", durationMinutes: 22 },
      { title: "ال dna وتركيبها", description: "تركيب DNA وآليات النسخ والترجمة في التعبير عن الجينات.", durationMinutes: 28 },
      { title: "الوراثة المرتبطة بالجنس", description: "الصفات المرتبطة بالجنس والصفات السائدة والمتنحية على الكروموسوم X.", durationMinutes: 22 },
      { title: "الמוטاجين والطفرات", description: "أنواع الطفرات الجينية وأسبابها وتأثيرها على الكائنات الحية.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 1,
    subject: "الرياضيات",
    name: "التفاضل والتكامل",
    description: "مبادئ التفاضل وتطبيقاته في إيجاد الميل ومعدلات التغير والأقصى والأدنى.",
    price: 60,
    term: "SECOND_TERM",
    lessons: [
      { title: "المفاهيم الأولية للتفاضل", description: "معدل التغير الاقترابي والميل المستقيممماس للمنحنى.", durationMinutes: 22 },
      { title: "قواعد التفاضل", description: "قواعد الضرب والقسمة والتصعيد وقواعد التفاضل المتكررة.", durationMinutes: 28 },
      { title: "تطبيقات التفاضل", description: "إيجادMaxima وMinima والاقتراب الخطي وتطبيقات الحركة.", durationMinutes: 25 },
      { title: "مبدأ التكامل", description: "تعريف التكامل وعلاقته بالتفاضل والتطبيقات في حساب المساحات.", durationMinutes: 28 },
      { title: "تطبيقات التكامل", description: "حساب حجم الأجسام الدورانية والمساحات المحصورة بين المنحنيات.", durationMinutes: 25 },
    ],
  },
  {
    stageIndex: 1,
    subject: "اللغة العربية",
    name: "البلاغة العربية",
    description: "دراسة فنون البلاغة العربية: المعاني والبيان والبديع وأصولها.",
    price: 35,
    term: "SECOND_TERM",
    lessons: [
      { title: "علم المعاني", description: "الخبر والإنشاء وعلاقتهما بالقصد، أسلوب الشرط والعرض والقسم.", durationMinutes: 22 },
      { title: "المخاطب والخبر", description: "أخبار الأوابد والمسند والمسند إليه وأحواله.", durationMinutes: 20 },
      { title: "علم البيان", description: "التشبيه والمجاز والاستعارة وصور البلاغة البيانية.", durationMinutes: 25 },
      { title: "الاستعارة وأنواعها", description: "الاستعارة التمثيلية والمحسّنة والبدية وتطبيقاتها.", durationMinutes: 22 },
      { title: "علم البديع", description: "الطباق والجناس وانساب اللفظ و和谐 المعنى في البلاغة.", durationMinutes: 24 },
    ],
  },
  {
    stageIndex: 1,
    subject: "اللغة الإنجليزية",
    name: "Reading and Writing Skills",
    description: "تطوير مهارات القراءة والكتابة في اللغة الإنجليزية مع التركيز على النصوص الأدبية.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "Reading Comprehension Strategies", description: "استراتيجيات فهم المقروء: التلخيص والاستنتاج والربط.", durationMinutes: 22 },
      { title: "Essay Writing", description: "كتابة المقالات الإنجليزية: المقدمة والعرض والخاتمة.", durationMinutes: 25 },
      { title: "Vocabulary Building", description: "توسيع المفردات باستخدام السياق والجذور اللاتينية واليونانية.", durationMinutes: 20 },
      { title: "Formal vs Informal Writing", description: "الفرق بين الكتابة الرسمية وغير الرسمية وuso كل نوع.", durationMinutes: 18 },
      { title: "Grammar Review", description: "مراجعة شاملة للقواعد الإنجليزية الأساسية.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 1,
    subject: "الفلسفة",
    name: "المنطق الفلسفي",
    description: "أساسيات المنطق الأرسطي وقواعد الاستدلال الصحيح والتفكير النقدي.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "مقدمة في المنطق", description: "تعريف المنطق وأهميته و mối liên hệ مع الفلسفة.", durationMinutes: 20 },
      { title: "المفاهيم والتعريفات", description: "أنواع المفاهيم وعلاقاتها وقواعد التعريف الصحيحة.", durationMinutes: 22 },
      { title: "القضايا المنطقية", description: "أنواع القضايا: الكونية والجزئية والإيجابية والسلبية.", durationMinutes: 25 },
      { title: "الاستدلال الاستنباطي", description: "القياس المنطقية وقواعدها وصحة المقدمة والنتيجة.", durationMinutes: 28 },
      { title: "الأخطاء المنطقية", description: "الأخطاء الشائعة في التفكير وكيفية تجنبها.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 1,
    subject: "الجغرافيا",
    name: "السكان والنشاط البشري",
    description: "دراسة توزيع سكان العالم وأنشطتهم الاقتصادية وتأثيرها على البيئة.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "توزيع سكان العالم", description: "أقاليم توزيع السكان والعوامل الطبيعية والبشرية المؤثرة فيه.", durationMinutes: 22 },
      { title: "النمو السكاني", description: "rates النمو السكاني وعوامله وتأثيره على الموارد.", durationMinutes: 20 },
      { title: "النشاط الزراعي", description: "أنواع الزراعة وعواملها وتأثير المناخ عليها.", durationMinutes: 25 },
      { title: "النشاط الصناعي", description: "عوامل الموقع الصناعي وأنواع الصناعات وتوزيعها.", durationMinutes: 22 },
      { title: "النشاط السياحي", description: "أنواع السياحة وعواملها وتأثيرها على اقتصاد الدول.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 1,
    subject: "التاريخ",
    name: "تاريخ الإسلام",
    description: "دراسة البعثة النبوية ولفترة الراشدة وتوسع الدولة الإسلامية.",
    price: 30,
    term: "FIRST_TERM",
    lessons: [
      { title: "البعثة النبوية", description: "سياق بعثة النبي محمد صلى الله عليه وسلم والأحداث الأولى.", durationMinutes: 22 },
      { title: "الهجرة النبوية", description: "أسباب وأحداث الهجرة وتأسيس الدولة الإسلامية في المدينة.", durationMinutes: 25 },
      { title: "غزوات الرسول", description: "أهم الغزوات دراسة وتحليل: بدر وأحد والخندق وصلح الحديبية.", durationMinutes: 28 },
      { title: "الفتوحات الإسلامية", description: "الفتوحات في عهد أبي بكر وعمر وتوسع الدولة الإسلامية.", durationMinutes: 25 },
      { title: "العهد الراشد", description: "الحكم في عهد الخلفاء الراشدين وأبرز إنجازاتهم.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 1,
    subject: "العلوم",
    name: "ميكانيكا الموائع",
    description: "دراسة خواص الموائع (السوائل والغازات) وقوانينها الفيزيائية.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "خصائص الموائع", description: "اللزوجة والكثافة والضغط في الموائع وقياسها.", durationMinutes: 22 },
      { title: "قانون باسكال", description: "نقل الضغط في السوائل وتطبيقاته في الضاغطات الهوائية.", durationMinutes: 25 },
      { title: "قانون أرشيمايدس", description: "مبدأ الطفو وحساب القوة الطاردة وتطبيقاته العملية.", durationMinutes: 22 },
      { title: "قانون برنولي", description: "علاقة الضغج والسرعة والارتفاع في حركة الموائع.", durationMinutes: 28 },
      { title: "الغازات المثالية", description: "قوانين الغازات: Boyle وCharles وAvogadro وتطبيق قانون الغازات المثالية.", durationMinutes: 25 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 2 — الصف الثالث الثانوي
  // ═══════════════════════════════════════════════════════════════════
  {
    stageIndex: 2,
    subject: "الكيمياء",
    name: "العناصر الانتقالية",
    description: "دراسة العناصر الانتقالية وخصائصها الكيميائية وتطبيقاتها في الحياة اليومية.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "مقدمة عن العناصر الانتقالية", description: "تعريف العناصر الانتقالية ومواضعها في الجدول الدوري وخصائصها العامة.", durationMinutes: 20 },
      { title: "الحديد والفولاذ", description: "استخراج الحديد وتصنيع الفولاذ وتطبيقاتهما الصناعية.", durationMinutes: 25 },
      { title: "النحاس والفضة", description: "خصائص النحاس والفضة واستخداماتهما في الأسلاك الكهربائية والمجوهرات.", durationMinutes: 22 },
      { title: "الذهب البلاتين", description: "خصائص المعادن الثمينة واستخداماتها في صناعة المجوهرات وال ELECTRONICS.", durationMinutes: 20 },
      { title: "الكيمياء الصناعية للعناصر الانتقالية", description: "تطبيقات العناصر الtransitionية في التحفيز الكيميائي والألوان.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الكيمياء",
    name: "التحليل الكيميائي",
    description: "أساسيات التحليل الكيميائي النوعي والكمي والطرق التحليلية المستخدمة في المختبرات.",
    price: 45,
    term: "FIRST_TERM",
    lessons: [
      { title: "التحليل الكيميائي النوعي", description: "تعريف التحليل النوعي واكتشاف الأيونات باستخدام تفاعل الت Precipitation.", durationMinutes: 22 },
      { title: "تحليل الأيونات", description: "اختبارات كشف الأيونات الموجبة والسالبة في المحاليل.", durationMinutes: 25 },
      { title: "التحليل الكيميائي الكمّي", description: "طرق القياس الكمي: التtitration والقياس الضوئي.", durationMinutes: 28 },
      { title: "حسابات المول والتركيز", description: "حسابات المولية والتركيز المولية والنسبة المئوية الكيميائية.", durationMinutes: 25 },
      { title: "التحليل بالtitration", description: "titration الأحماض والقواعد وtitration الأكاسيد والميوعات.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الكيمياء",
    name: "الاتزان الكيميائي",
    description: "دراسة الاتزان الكيميائي والعوامل المؤثرة فيه وقانون لو شاتلييه.",
    price: 55,
    term: "SECOND_TERM",
    lessons: [
      { title: "مقدمة عن الاتزان الكيميائي", description: "تعريف الاتزان الكيميائي وشروطه ومفهوم ثابت الاتزان.", durationMinutes: 22 },
      { title: "قانون لو شاتلييه", description: "تأثير التغيرات في الضغج والحرارة والتركيز على موضع الاتزان.", durationMinutes: 25 },
      { title: "ثابت الاتزان", description: "حساب ثابت الاتزان Keq وKeqp وعلاقتهما بالحرجة الحرة.", durationMinutes: 28 },
      { title: "الأحماض والقواعد", description: "تعريف الأحماض والقواعد وحساب pH المحاليل المائية.", durationMinutes: 25 },
      { title: "التحليل الكهربي للمحاليل", description: "التأين وحسابات التأين وموصلية المحاليل الكهربائية.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الكيمياء",
    name: "الكيمياء الكهربية",
    description: "دراسة التفاعلات الكيميائية التي تتحول فيها الطاقة الكيميائية إلى كهربائية والعكس.",
    price: 65,
    term: "SECOND_TERM",
    lessons: [
      { title: "الخلايا الكهروكيميائية", description: "مبادئ عمل الخلية الكهروكيميائية وتفاوت التأكسد.", durationMinutes: 22 },
      { title: "ال电镀 والتغليف", description: "电镀 المعادن باستخدام الكهرباء وحماية المعادن من التآكل.", durationMinutes: 25 },
      { title: "البطاريات", description: "أنواع البطاريات: الجافة والشحناء وتركيبها وعملها.", durationMinutes: 22 },
      { title: "التحليل الكهربائي", description: "استخدام الكهرباء في تحليل المركبات واستخلاص المعادن.", durationMinutes: 28 },
      { title: "الطاقة الكهروكيميائية", description: "حساب الطاقة الحرة الغيبس وعلاقتها بالجهد الكهربائي.", durationMinutes: 25 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الكيمياء",
    name: "الكيمياء العضوية",
    description: "دراسة مركبات الكربون وتصنيفها وتفاعلاتها الأساسية.",
    price: 75,
    term: "SECOND_TERM",
    lessons: [
      { title: "مقدمة في الكيمياء العضوية", description: "تعريف المركبات العضوية وتصنيفها إلى هيدروكربونات ومشتقاتها.", durationMinutes: 20 },
      { title: "الهيدروكربونات المشبعة", description: "الألكانات وخصائصها وتفاعلات الحموضة والإزالة.", durationMinutes: 25 },
      { title: "الهيدروكربونات غير المشبعة", description: "الألكاينات والألكاينات وتفاعلات الإضافة.", durationMinutes: 28 },
      { title: "المركبات الوظيفية", description: "الأحماض الكربوكسيلية والكحولات والأحماض الأمينية.", durationMinutes: 25 },
      { title: "البوليمرات", description: "أنواع البوليمرات: الطبيعية والصناعية وتصنيعها.", durationMinutes: 22 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الفيزياء",
    name: "الكهرباء والموصلات",
    description: "دراسة الدائرة الكهربائية وقانون أوم وقوانين كيرشوف وتطبيقاتها.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "التيار الكهربائي وقانون أوم", description: "تعريف التيار الكهربائي والجهد الكهربائي وقانون أوم.", durationMinutes: 22 },
      { title: "المقاومات série وparallèle", description: "串联 و_parallel المقاومات وحساب المقاومة المكافئة.", durationMinutes: 25 },
      { title: "قوانين كيرشوف", description: "قانون التيار وقانون الجهد في الدوائر الكهربائية المعقدة.", durationMinutes: 28 },
      { title: "الطاقة الكهربائية", description: "حساب الطاقة الكهربائية والاستهلاك وتكلفة الكهرباء.", durationMinutes: 22 },
      { title: "المقاومات المقاومة والموصلية", description: "عوامل المقاومة الكهربائية وتطبيق قانون أوم الكلي.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الفيزياء",
    name: "الموجات والصوت",
    description: "دراسة أنواع الموجات وخصائصها والصوت وسلوكه كموجة ميكانيكية.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "أنواع الموجات", description: "التمييز بين الموجات الطولية والعرضية وخصائصها.", durationMinutes: 20 },
      { title: "خصائص الموجات", description: "الطول والتردد والسرعة والطول وعلاقة السرعة بالطول والتردد.", durationMinutes: 25 },
      { title: "الصوت وخصائصه", description: "الصوت كموجة ميكانيكية وسرعة انتقاله في الوسائط المختلفة.", durationMinutes: 22 },
      { title: "ظواهر الموجات", description: "المنعكس والانكسار والحرج والتداخل الموجي.", durationMinutes: 28 },
      { title: "الصوتيات", description: "الرنين الصوتي وتطبيقاته في الموسيقى والهندسة المعمارية.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الأحياء",
    name: "التطور والتنوع الحيوي",
    description: "دراسة نظرية التطور والتنوع البيولوجي وعلاقتها بالتكيف البيئي.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "مقدمة في التطور", description: "نظريات التطور السابقة ونظرية دارون في الانتقاء الطبيعي.", durationMinutes: 22 },
      { title: "الأدلة على التطور", description: "الأدلة الحيوية والتشريحية والجزيئية على صحة نظرية التطور.", durationMinutes: 25 },
      { title: "التنوع البيولوجي", description: "مستويات التنوع البيولوجي: التنوع الجيني والنوعي وال Ekosystemي.", durationMinutes: 22 },
      { title: "التكيف والتطور", description: "آليات التكيف وعلاقتها بالتطور والبيئة.", durationMinutes: 20 },
      { title: "المحافظة على التنوع البيولوجي", description: "أهمية التنوع البيولوجي و威胁اته وطرق الحفاظ عليه.", durationMinutes: 18 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الرياضيات",
    name: "المثلثات والاقترانات",
    description: "دراسة الاقترانات المثلثية وتطبيقاتها في حل المثلثات القائمة وغير القائمة.",
    price: null,
    term: "FIRST_TERM",
    lessons: [
      { title: "الاقترانات المثلثية", description: "تعريف الاقترانات المثلثية وعلاقاتها الأساسية.", durationMinutes: 22 },
      { title: "المثلثات القائمة", description: "تطبيقات الاقترانات المثلثية في حل المثلثات القائمة.", durationMinutes: 25 },
      { title: "قوانين الجيب وجيب التمام", description: "قوانين المثلثات: قانون الجيب وقانون جيب التمام.", durationMinutes: 28 },
      { title: "المعادلات المثلثية", description: "حل المعادلات المثلثية البسيطة والمركبة.", durationMinutes: 22 },
      { title: "تطبيقات المثلثات", description: "تطبيقات المثلثات في القياس والهندسة الفراغية.", durationMinutes: 20 },
    ],
  },
  {
    stageIndex: 2,
    subject: "الجيولوجيا",
    name: "الياقات الصخرية والدورة الجيولوجية",
    description: "دراسة الدورة الجيولوجية الكبرى وتشكيل الياقات الصخرية وتراكمها.",
    price: null,
    term: "SECOND_TERM",
    lessons: [
      { title: "الدورة الجيولوجية الكبرى", description: "مراحل الدورة الجيولوجية: الرض وتفتيت ونقل وترسيب وتحول.", durationMinutes: 25 },
      { title: "types الصخور الرسوبية", description: "تصنيف الصخور الرسوبية: النهرية والبحرية والصحرائية.", durationMinutes: 22 },
      { title: "الصخور المتحولة", description: "أنواع التحول الصخري: التحول الإقليمي وال Contact.", durationMinutes: 25 },
      { title: "الحقب الجيولوجية", description: "تقسيم التاريخ الجيولوجي للأرض إلى حقب وفروع.", durationMinutes: 22 },
      { title: "الحفريات", description: "أنواع الحفريات وقيمتها في تحديد أعمار الصخور والبيئات القديمة.", durationMinutes: 20 },
    ],
  },
];

export const QUIZ_TEMPLATES: QuizTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════
  // Stage 0 quizzes
  // ═══════════════════════════════════════════════════════════════════
  {
    chapterIndex: 0, title: "اختبار مقدمة في تركيب المادة", description: " اختبر فهمك لمفاهيم تركيب المادة الأساسية.", difficulty: "EASY", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "ما هي الحالات الأساسية الثلاث للمادة؟", options: ["صلبة، سائلة، غازية", "متحولة، رسوبية، نارية", "إيجابية، سالبة، محايدة", "مغناطيسية، كهربائية، حرارية"], correctAnswer: "صلبة، سائلة، غازية", explanation: "المادة tồn ثلاث حالات أساسية: صلبة وسائلة وغازية.", points: 2 },
      { type: "TRUE_FALSE", text: "العدد الذري يساوي عدد البروتونات في النواة.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "العدد الذري يمثل عدد البروتونات في النواة.", points: 1 },
      { type: "MCQ", text: "أين توجد العناصر الفلزية في الجدول الدوري؟", options: ["الجهة اليسرى والوسطى", "الجهة اليمنى فقط", "في الأعمدة الرأسية", "في الأسفل فقط"], correctAnswer: "الجهة اليسرى والوسطى", explanation: "العناصر الفلزية تقع في الجزء الأيسر والأوسط من الجدول الدوري.", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين العدد الذري والعدد الكتلي مع إعطاء مثال.", options: [], correctAnswer: null, explanation: "العدد الذري = عدد البروتونات، العدد الكتلي = مجموع البروتونات والنيوترونات. مثال: الكربون C-12 له 6 بروتونات و6 نيوترونات.", points: 3 },
      { type: "TRUE_FALSE", text: "النظير الذري لها نفس العدد الذري وعدد كتلي مختلف.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "النظير الذري: نفس العدد الذري (نفس البروتونات) لكن بعدد نيوترونات مختلفة.", points: 1 },
    ],
  },
  {
    chapterIndex: 1, title: "اختبار الكميات الفيزيائية والقياس", description: "اختبر معرفتك بالقياس في الفيزياء.", difficulty: "EASY", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "أي من الكميات التالية هي كمية متجهة؟", options: ["الكتلة", "الزمن", "القوة", "المسافة"], correctAnswer: "القوة", explanation: "القوة لها مقدار واتجاه nên هي كمية متجهة.", points: 2 },
      { type: "TRUE_FALSE", text: "السرعة هي كمية اتجاهية.", options: ["صح", "خطأ"], correctAnswer: "خطأ", explanation: "السرعة هي كمية قياسية (مقدار فقط)، بينما السرعة المتجهة هي كمية متجهة.", points: 1 },
      { type: "MCQ", text: "ما هي الوحدة الأساسية للطول في النظام الدولي؟", options: ["الكيلومتر", "المتر", "السنتيمتر", "الإنش"], correctAnswer: "المتر", explanation: "المتر هي الوحدة الأساسية للطول في النظام الدولي للوحدات.", points: 2 },
      { type: "MCQ", text: "كيفية حساب الخطأ النسبي؟", options: ["(الخطأ المطلق/القيمة الحقيقية) × 100%", "الخطأ المطلق × القيمة الحقيقية", "القيمة الحقيقية / الخطأ المطلق", "الخطأ المطلق + القيمة الحقيقية"], correctAnswer: "(الخطأ المطلق/القيمة الحقيقية) × 100%", explanation: "الخطأ النسبي = (الخطأ المطلق / القيمة الحقيقية) × 100%", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين الكمية القياسية والكمية المتجهة مع مثالين لكل منهما.", options: [], correctAnswer: null, explanation: "الكمية القياسية: لها مقدار فقط (كتلة، زمن، مسافة). الكمية المتجهة: لها مقدار واتجاه (قوة، سرعة متجهة، إزاحة).", points: 3 },
    ],
  },
  {
    chapterIndex: 2, title: "اختبار الخلية وحدة الحياة", description: "اختبر معرفتك بالخلية وتركيبها.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "ما هو العضو الخليوي الذي ينتج الطاقة؟", options: ["الميتوكوندريا", "النواة", "الشبكة الإندوبلازمية", "جهاز جولجي"], correctAnswer: "الميتوكوندريا", explanation: "الميتوكوندريا هي محطة الطاقة في الخلية حيث تتم عملية التنفس الخلوي.", points: 2 },
      { type: "TRUE_FALSE", text: "الخلية النباتية تحتوي على جدران خلوية.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "الخلايا النباتية لها جدار خلوي من السليلوز يحيط بالغشاء الخلوي.", points: 1 },
      { type: "MCQ", text: "ما هي وظيفة النواة الخلوية؟", options: ["تخزين المعلومات الوراثية وتنظيم نشاط الخلية", "إنتاج الطاقة", "نقل المواد", "هضم المواد العضوية"], correctAnswer: "تخزين المعلومات الوراثية وتنظيم نشاط الخلية", explanation: "النواة تحتوي على DNA وهي المسؤولة عن التخزين والتعبير عن المعلومات الوراثية.", points: 2 },
      { type: "ESSAY", text: "قارن بين الخلية الحيوانية والنباتية من حيث التركيب والوظيفة.", options: [], correctAnswer: null, explanation: "النباتية: جدار خلوي، بلاستيدات خضراء، فجوة مركزية كبيرة. الحيوانية: لا جدار، سنتريول، فجوات صغيرة.", points: 3 },
      { type: "MCQ", text: "ما هو العضو الخليوي المسؤول عن تصنيع البروتينات؟", options: ["الريبوسومات", "الميتوكوندريا", "الغشاء الخلوي", "النواة"], correctAnswer: "الريبوسومات", explanation: "الريبوسومات هي مواقع تصنيع البروتينات في الخلية.", points: 2 },
    ],
  },
  {
    chapterIndex: 3, title: "اختبار الجبر والمتغيرات", description: "اختبر مهاراتك في الجبر الأساسي.", difficulty: "EASY", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "إذا كان 3x + 7 = 22، فإن x تساوي:", options: ["5", "7", "3", "15"], correctAnswer: "5", explanation: "3x + 7 = 22 → 3x = 15 → x = 5", points: 2 },
      { type: "TRUE_FALSE", text: "المعادلة x² = 4 لها حل واحد فقط.", options: ["صح", "خطأ"], correctAnswer: "خطأ", explanation: "x² = 4 لها حلان: x = 2 و x = -2.", points: 1 },
      { type: "MCQ", text: "نسبة مئوية من 50 تساوي 20، ما هي النسبة المئوية؟", options: ["25%", "40%", "10%", "50%"], correctAnswer: "40%", explanation: "20/50 × 100% = 40%.", points: 2 },
      { type: "MCQ", text: "في الدالة f(x) = 2x + 3، ما هي قيمة f(4)؟", options: ["11", "8", "14", "5"], correctAnswer: "11", explanation: "f(4) = 2(4) + 3 = 8 + 3 = 11.", points: 2 },
      { type: "ESSAY", text: "اشرح مفهوم التناسب الطردي وأعطِ مثالاً من الحياة اليومية.", options: [], correctAnswer: null, explanation: "التناسب الطردي: عند زيادة أحد المتغيرات يزداد الآخر بنفس النسبة. مثال: كلما زادت السرعة زادت المسافة المقطوعة في نفس الوقت.", points: 3 },
    ],
  },
  {
    chapterIndex: 4, title: "اختبار النحو والصرف", description: "اختبر معرفتك بالنحو العربي.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "ما هو حكم (محمد) في جملة: قام محمد.", options: ["فاعل مرفوع", "مفعول به منصوب", "مبتدأ مرفوع", "خبر مرفوع"], correctAnswer: "فاعل مرفوع", explanation: "محمد فاعل因为他 قام فعل والفاعل يرفع.", points: 2 },
      { type: "TRUE_FALSE", text: "المبتدأ يجب أن يكون معرفة.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "المبتدأ يكون معرفة أو نكرة مع التوكيد أو الظرف أو الخبر شبه جملة.", points: 1 },
      { type: "MCQ", text: "أي مما يلي جملة اسمية؟", options: ["الطالب مجتهد", "ذهب الطالب", "سيكتب الدرس", "هل قرأ الطالب؟"], correctAnswer: "الطالب مجتهد", explanation: "جملة اسمية تبدأ بمسمى (مبتدأ) وخبر لا بفعل.", points: 2 },
      { type: "MCQ", text: "ما حكم (كتابًا) في جملة: قرأت كتابًا؟", options: ["مفعول به منصوب", "فاعل مرفوع", "حال منصوب", "تمييز منصوب"], correctAnswer: "مفعول به منصوب", explanation: "كتابًا مفعول به因为他 فعل والفعل ناقص والمفعول به منصوب.", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين النعت والبدل مع إعطاء مثال لكل منهما.", options: [], correctAnswer: null, explanation: "النعت: صفة تتبع الموصوف في الإعراب (طالب مجتهد). البدل: يتبع المبدل منه في كل أحكامه (قرأ الطالب الدليل).", points: 3 },
    ],
  },
  {
    chapterIndex: 5, title: "اختبار أساسيات القواعد الإنجليزية", description: "اختبر قواعد الإنجليزية الأساسية.", difficulty: "EASY", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "What is the correct form: She ___ to school every day.", options: ["goes", "go", "going", "gone"], correctAnswer: "goes", explanation: "Third person singular (she) requires 'goes' in present simple.", points: 2 },
      { type: "TRUE_FALSE", text: "The word 'beautiful' is a verb.", options: ["True", "False"], correctAnswer: "False", explanation: "'Beautiful' is an adjective, not a verb.", points: 1 },
      { type: "MCQ", text: "Choose the correct past tense: They ___ dinner last night.", options: ["had", "have", "has", "having"], correctAnswer: "had", explanation: "Past simple of 'have' is 'had'.", points: 2 },
      { type: "MCQ", text: "Which sentence is negative?", options: ["He doesn't like coffee", "He likes coffee", "Does he like coffee?", "He is liking coffee"], correctAnswer: "He doesn't like coffee", explanation: "Negative sentences use 'don't/doesn't + base form'.", points: 2 },
      { type: "ESSAY", text: "Write three sentences using different tenses (present, past, future).", options: [], correctAnswer: null, explanation: "Example: Present: I study English. Past: I studied English yesterday. Future: I will study English tomorrow.", points: 3 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════
  // Stage 1 quizzes
  // ═══════════════════════════════════════════════════════════════════
  {
    chapterIndex: 10, title: "اختبار الروابط الكيميائية", description: "اختبر فهمك لأنواع الروابط الكيميائية.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "تتكون الرابطة الأيونية ب:", options: ["انتقال الإلكترونات من فلز إلى لا فلز", "مشاركة الإلكترونات بين لا فلزيين", "جذب بين الشحنتين", "تفاعل كيميائي"], correctAnswer: "انتقال الإلكترونات من فلز إلى لا فلز", explanation: "الرابطة الأيونية تتشكّل بانتقال إلكترون أو أكثر من ذرة فلزية إلى ذرة لا فلزية.", points: 2 },
      { type: "TRUE_FALSE", text: "الرابطة التساهمية أقوى من الرابطة الأيونية دائمًا.", options: ["صح", "خطأ"], correctAnswer: "خطأ", explanation: "rength الروابط تعتمد على طبيعة الذرات وħa_conditions. بعض الروابط الأيونية أقوى.", points: 1 },
      { type: "MCQ", text: "في الجزيء H₂O، ما هي الشكل الهندسي للجزيء؟", options: ["خطي", "مثلث مستوٍ", "-angular (bent)", "tetrahedral"], correctAnswer: "angular (bent)", explanation: "H₂O لها شكل z-angle بسبب أزواج الإلكترونات غير المقترنة.", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين الرابطة الأحادية والثنائية والثلاثية مع مثال لكل منها.", options: [], correctAnswer: null, explanation: "الأحادية: مشاركة زوج واحد (H-H). الثنائية: مشاركة زوجين (O=O). الثلاثية: مشاركة ثلاثة أزواج (N≡N).", points: 3 },
      { type: "MCQ", text: "أي من المركبات التالية يحتوي على رابطة تساهمية قطبية؟", options: ["H₂O", "O₂", "N₂", "Fe"], correctAnswer: "H₂O", explanation: "H₂O فيه فرق في الكهروسلبية بين H وO فيتكون جزيء قطبي.", points: 2 },
    ],
  },
  {
    chapterIndex: 11, title: "اختبار القوى والحركة", description: " اختبر قوانين نيوتن وتطبيقاتها.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "قانون نيوتن الثاني ينص على أن:", options: ["F = ma", "F = mv", "F = mg", "F = mx"], correctAnswer: "F = ma", explanation: "قانون نيوتن الثاني: القوة تساوي الكتلة مضروبة في التسارع.", points: 2 },
      { type: "TRUE_FALSE", text: "الجسم الساكن يبقى ساكنًا ما لم تؤثر عليه قوة خارجية.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "هذا قانون نيوتن الأول (مبدأ القصور الذاتي).", points: 1 },
      { type: "MCQ", text: "قوة الاحتكاك السكوني تساوي في المقدار:", options: ["القوة الدافعة حتى يتحرك الجسم", "الوزن × معامل الاحتكاك", "الكتلة × التسارع", "الوزن ÷ الميل"], correctAnswer: "القوة الدافعة حتى يتحرك الجسم", explanation: "قوة الاحتكاك السكوني تساوي القوة الدافعة حتى تبدأ الحركة.", points: 2 },
      { type: "MCQ", text: "إذا كانت كتلة 5 كجم والتسارع 3 m/s²، فإن القوة تساوي:", options: ["15 N", "8 N", "1.67 N", "2.5 N"], correctAnswer: "15 N", explanation: "F = ma = 5 × 3 = 15 N.", points: 2 },
      { type: "ESSAY", text: "اشرح قانون نيوتن الثالث مع مثال من الحياة اليومية.", options: [], correctAnswer: null, explanation: "القانون الثالث: لكل فعل رد فعل مساوٍ له في المقدار ومعاكس له في الاتجاه. مثال: عند المشي يدفع القدم الأرض للخلف والأرض تدفع القدم للأمام.", points: 3 },
    ],
  },
  {
    chapterIndex: 12, title: "اختبار الوراثة والمعلومات الوراثية", description: "اختبر قوانين مندل والوراثة الجزيئية.", difficulty: "HARD", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "في تجربة مندل، ماذا يحدث عند تهجين حمض حلو (AA) مع حمض مر (aa)؟", options: ["جميع الأبناء Aa (حمض حلو)", "نصفهم AA ونصفهم aa", "جميعهم aa", "三分之一 حلو و三分之一 مر"], correctAnswer: "جميع الأبناء Aa (حمض حلو)", explanation: "جميع الأبناء من الجيل الأول سيكونوا Aa (حمض حلو) بسبب سيادة Allele A.", points: 2 },
      { type: "TRUE_FALSE", text: "DNA مزدوج الشريحة وشكلها حلزون مزدوج.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "DNA يتكون من سلسلتين مزدوجتين بنيويتين ملتفتين في شكل حلزون مزدوج.", points: 1 },
      { type: "MCQ", text: "ما هي وظيفة الriboosome؟", options: ["تصنيع البروتينات", "تخزين DNA", "إنتاج الطاقة", "هضم المواد"], correctAnswer: "تصنيع البروتينات", explanation: "الريبوسومات هي مواقع ترجمة mRNA إلى بروتينات.", points: 2 },
      { type: "ESSAY", text: "اشرح قانون مندل الثاني (التوزيع المستقل) مع مثال.", options: [], correctAnswer: null, explanation: "القانون الثاني: تنفصل Allelesduring تكوّن البويضة أو الحيوان المنوي. مثال: في نبات AaBb، تنفصل الصبغيات بشكل مستقل.", points: 3 },
      { type: "MCQ", text: "أي من الآتي ليس من أنواع الطفرات الجينية؟", options: ["الاحتكاك", "الاستبدال", "الإدراج", "الحذف"], correctAnswer: "الاحتكاك", explanation: "أنواع الطفرات: الاستبدال والإدراج والحذف. الاحتكاك ليس نوعًا من الطفرات.", points: 2 },
    ],
  },
  {
    chapterIndex: 13, title: "اختبار التفاضل والتكامل", description: "اختبر مهاراتك في التفاضل والتكامل.", difficulty: "HARD", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "مشتق الدالة f(x) = x³ يساوي:", options: ["3x²", "x²", "3x³", "x³"], correctAnswer: "3x²", explanation: "باستخدام قاعدة التصعيد: d/dx(xⁿ) = nxⁿ⁻¹.", points: 2 },
      { type: "TRUE_FALSE", text: "التكامل هو العملية العكسية للتفاضل.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "التكامل والتفاضل عمليةان متعاكستان في التحليل الرياضي.", points: 1 },
      { type: "MCQ", text: "∫ 2x dx =", options: ["x² + C", "2x² + C", "x + C", "2 + C"], correctAnswer: "x² + C", explanation: "∫ 2x dx = 2∫ x dx = 2(x²/2) + C = x² + C.", points: 2 },
      { type: "MCQ", text: "إذا كانت f(x) = sin(x)، فإن f'(x) تساوي:", options: ["cos(x)", "-cos(x)", "-sin(x)", "tan(x)"], correctAnswer: "cos(x)", explanation: "المشتق للدالة sin(x) هو cos(x).", points: 2 },
      { type: "ESSAY", text: "اشرح كيف تستخدم التفاضل لإيجاد القيمة القصوى والدنيا لدالة معينة.", options: [], correctAnswer: null, explanation: "نوجد المشتق، نعادلها بالصفر، نجد x، ثم نستخدم الاختبار الثاني أو الرسم البياني لتحديد القصوى والدنيا.", points: 3 },
    ],
  },
  {
    chapterIndex: 14, title: "اختبار البلاغة العربية", description: "اختبر معرفتك بفنون البلاغة.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "أي من الفنون التالية يدخل في علم البيان؟", options: ["التشبيه والمجاز", "الطباق", "الجنس", "السجع"], correctAnswer: "التشبيه والمجاز", explanation: "علم البيان يشمل: التشبيه والمجاز والاستعارة.", points: 2 },
      { type: "TRUE_FALSE", text: "الطباق من فنون البديع.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "الطباق من فنون البديع ويشمل التضاد في المعنى.", points: 1 },
      { type: "MCQ", text: "في التشبيه، ما الذي يقوم به الشبيه به؟", options: ["منطوب", "مشبّه به", "أداة التشبيه", "وجه الشبه"], correctAnswer: "مشبّه به", explanation: "التشبيه: مشبّه + أداة + مشبّه به + وجه شبه.", points: 2 },
      { type: "MCQ", text: "الاستعارة تمثل:", options: ["تشبيه تام بدون أداة", "استعارة بليغة", "مجاز مرسل", "تشبيه مركّب"], correctAnswer: "تشبيه تام بدون أداة", explanation: "الاستعارة هي تشبيه حذف منه المشبه وأداة التشبيه وأبقى المشبه به.", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين الاستعارة التمثيلية والاستعارة المحسة مع مثال لكل.", options: [], correctAnswer: null, explanation: "التمثيلية: تشبه المعقول بالمحسوس (العلم نور). المحسنة: تشبه المحسوس بالمحسوس (وجهه قمر).", points: 3 },
    ],
  },
  {
    chapterIndex: 15, title: "اختبار Reading and Writing", description: " اختبر مهارات القراءة والكتابة بالإنجليزية.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "What is the main idea of a paragraph?", options: ["The topic sentence", "The conclusion", "Supporting details", "The title"], correctAnswer: "The topic sentence", explanation: "The main idea is usually expressed in the topic sentence.", points: 2 },
      { type: "TRUE_FALSE", text: "An essay should have at least three paragraphs.", options: ["True", "False"], correctAnswer: "True", explanation: "A basic essay has introduction, body, and conclusion paragraphs.", points: 1 },
      { type: "MCQ", text: "Which word is a synonym for 'happy'?", options: ["joyful", "sad", "angry", "tired"], correctAnswer: "joyful", explanation: "'Joyful' means the same as 'happy'.", points: 2 },
      { type: "MCQ", text: "What does 'infer' mean in reading?", options: ["To conclude from evidence", "To read quickly", "To skip sections", "To memorize"], correctAnswer: "To conclude from evidence", explanation: "Inferring means drawing conclusions based on clues in the text.", points: 2 },
      { type: "ESSAY", text: "Write a short paragraph about your favorite subject in school.", options: [], correctAnswer: null, explanation: "Students should write a coherent paragraph with topic sentence, supporting details, and conclusion.", points: 3 },
    ],
  },
  {
    chapterIndex: 16, title: "اختبار المنطق الفلسفي", description: " اختبر معرفتك بالمنطق والاستدلال.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "القياس المنطقية تتكون من:", options: ["مقدمتين ونتيجة", "فكرة واحدة", "سؤال وجواب", "فرضية ونفي"], correctAnswer: "مقدمتين ونتيجة", explanation: "القياس المنطقية: مقدمتان كبرى وصغرى ونتيجة.", points: 2 },
      { type: "TRUE_FALSE", text: "التفكير الاستنباطي ينتقل من العام إلى الخاص.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "الاستنباط: من القواعد العامة إلى استنتاجات خاصة.", points: 1 },
      { type: "MCQ", text: "أي من الآتي خطأ منطقي شائع؟", options: ["الاستدلال الدائري", "الاستدلال بالبرهان", "الاستدلال بالقياس", "الاستدلال بالتنبيه"], correctAnswer: "الاستدلال الدائري", explanation: "الاستدلال الدائري: استخدام النتيجة كمقدمة للوصول إلى النتيجة نفسها.", points: 2 },
      { type: "MCQ", text: "في القضية الجزئية الإيجابية، يشمل الاتصال:", options: ["جزء من الموضوع", "جميع الموضوع", "لا شيء", "جميع الموضوع والخبر"], correctAnswer: "جزء من الموضوع", explanation: "القضية الجزئية الإيجابية تشمل جزءًا من الموضوع فقط.", points: 2 },
      { type: "ESSAY", text: "اشرح الفرق بين الاستدلال الاستنباطي والاستقرائي مع مثال لكل.", options: [], correctAnswer: null, explanation: "الاستنباط: من القاعدة العامة إلى خاصة (كل إنسان يموت → سقراط إنسان → سقراط يموت). الاستقراء: من جزيئات إلى القاعدة (رايت أسدأ يأكل لحمًا → الأسود آكلة للحوم).", points: 3 },
    ],
  },
  {
    chapterIndex: 17, title: "اختبار تاريخ الإسلام", description: "اختبر معرفتك بالبعثة النبوية والفتوحات الإسلامية.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "متى كانت الهجرة النبوية؟", options: ["622م", "610م", "630م", "632م"], correctAnswer: "622م", explanation: "الهجرة النبوية كانت في عام 622م من مكة إلى المدينة.", points: 2 },
      { type: "TRUE_FALSE", text: "غ بدر كانت أول غزوة للرسول.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "غ بدر كانت أول معركة كبرى لل muslimين.", points: 1 },
      { type: "MCQ", text: "من هو أول خليفة رشيد؟", options: ["أبو بكر الصديق", "عمر بن الخطاب", "عثمان بن عفان", "علي بن أبي طالب"], correctAnswer: "أبو بكر الصديق", explanation: "أبو بكر الصديق هو أول الخلفاء الراشدين بعد وفاة الرسول.", points: 2 },
      { type: "MCQ", text: "في عهد من فُتحت القسطنطينية؟", options: ["عثمان بن عفان", "عمر بن الخطاب", "معاوية بن أبي سفيان", "الملك عبدالعزيز"], correctAnswer: "معاوية بن أبي سفيان", explanation: "لم تُفتح القسطنطينية في عصر الخلفاء الراشدين بل في عهد محمد الفاتح奥斯曼.", points: 2 },
      { type: "ESSAY", text: "اذكر أهم إنجازات الخلفاء الراشدين الأربعة.", options: [], correctAnswer: null, explanation: "أبو بكر: حرب الردة وجمع القرآن. عمر: الفتوحات وتنظيم الدولة. عثمان: كتابة المصحف وتوسيع الفتوحات. علي: العدل والحكم.", points: 3 },
    ],
  },
  {
    chapterIndex: 18, title: "اختبار العناصر الانتقالية", description: "اختبر معرفتك بالعناصر الانتقالية وتطبيقاتها.", difficulty: "MEDIUM", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "ما هي خاصية العناصر الانتقالية الشائعة؟", options: ["تكوين الألوان في المركبات", "عدم التفاعلكيميائي", "الaloofness", "الخفة الشديدة"], correctAnswer: "تكوين الألوان في المركبات", explanation: "العناصر الانتقالية تتميز بتكوين مركبات ملونة بسبب التشعب d.", points: 2 },
      { type: "TRUE_FALSE", text: "الحديد يصدأ بسبب التفاعل مع الماء والأكسجين.", options: ["صح", "خطأ"], correctAnswer: "صح", explanation: "صدأ الحديد: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃.", points: 1 },
      { type: "MCQ", text: "أي من المعادن التالية يستخدم في صناعة الأسلاك الكهربائية؟", options: ["النحاس", "الحديد", "الذهب", "الفضة"], correctAnswer: "النحاس", explanation: "النحاس موصل جيد للكهرباء ويستخدم في الأسلاك الكهربائية.", points: 2 },
      { type: "MCQ", text: "ما هو العنصر المستخدم في صناعة المقاومات الكهربائية؟", options: ["النيكل والكروم", "النحاس", "الفضة", "الحديد"], correctAnswer: "النيكل والكروم", explanation: "سبيكة النيكل والكروم (nichrome) تستخدم في المقاومات لارتفاع مقاومتها.", points: 2 },
      { type: "ESSAY", text: "اشرح كيف يُستخرج الحديد من خاماته وlist المراحل الأساسية.", options: [], correctAnswer: null, explanation: "1) سحق الخام. 2) الغسل. 3) التجفيف. 4) الإחם في فرن الجير. 5) الإ还原 في الفرن العالي.", points: 3 },
    ],
  },
  {
    chapterIndex: 19, title: "اختبار التحليل الكيميائي", description: "اختبر معرفتك بطرق التحليل الكيميائي.", difficulty: "HARD", status: "PUBLISHED",
    questions: [
      { type: "MCQ", text: "أي من الأساليب التالية تُستخدم في التحليل الكمّي؟", options: ["titration", "كشف الأيونات", "التحليل النوعي", "التجربة الحرة"], correctAnswer: "titration", explanation: "titration طريقة كميّة لتحديد تركيز مادة غير معروفة.", points: 2 },
      { type: "TRUE_FALSE", text: "التحليل النوعي يُستخدم لتحديد كمية المادة.", options: ["صح", "خطأ"], correctAnswer: "خطأ", explanation: "التحليل النوعي يُستخدم لتحديد نوع المادة وليس كميتها.", points: 1 },
      { type: "MCQ", text: "في titration، ما هي النقطة النهائية؟", options: ["النقطة التي يتغير فيها لون المحلول", "أول نقطة تفاعل", "نقطة التشبع", "نقطة البداية"], correctAnswer: "النقطة التي يتغير فيها لون المحلول", explanation: "النقطة النهائية: النقطة التي يتغير فيها لون المحلول المستخدم كمؤشر.", points: 2 },
      { type: "MCQ", text: "إذا أضفنا BaCl₂ إلى محلول يحتوي SO₄²⁻، فإن:", options: ["يتكون راسب أبيض", "يتكون راسب أصفر", "لا يحدث تفاعل", "يتكون غاز"], correctAnswer: "يتكون راسب أبيض", explanation: "BaCl₂ + Na₂SO₄ → BaSO₄↓ (أبيض) + 2NaCl.", points: 2 },
      { type: "ESSAY", text: "اشرح طريقة تحديد تركيز حمض بالtitration خطوة بخطوة.", options: [], correctAnswer: null, explanation: "1) أخذ حجم محدد من الحمض. 2) إضافة مادة مؤشر (فينول فثالين). 3) إضافة القاعدة ببطء مع التحريك. 4) تسجيل الحجم عند تغير اللون.", points: 3 },
    ],
  },
];
