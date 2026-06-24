import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // ─── Clean existing seed data ───────────────────────────────────────
  await prisma.lesson.deleteMany({ where: { id: { startsWith: "seed-" } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: "seed-" } } });
  await prisma.stage.deleteMany({ where: { id: { startsWith: "seed-" } } });
  await prisma.teacherProfile.deleteMany({
    where: { userId: { startsWith: "seed-" } },
  });
  await prisma.user.deleteMany({ where: { id: { startsWith: "seed-" } } });

  // ─── Admin ──────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const adminFullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
  const adminMobile = process.env.ADMIN_MOBILE ?? "01000000000";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: "seed-admin-1",
      email: adminEmail,
      fullName: adminFullName,
      mobile: adminMobile,
      password: await bcrypt.hash(adminPassword, 10),
      role: Role.ADMIN,
    },
  });
  console.log(`Admin: ${adminEmail}`);

  // ─── Teacher A — أحمد حسان (رياضيات) ──────────────────────────────
  const teacherAId = "seed-teacher-a";
  const teacherA = await prisma.user.create({
    data: {
      id: teacherAId,
      fullName: "أحمد حسان",
      email: "ahmed.hassan@school.edu",
      mobile: "01110000001",
      password: await bcrypt.hash("Teacher@123456", 10),
      role: Role.OPERATION,
      teacherProfile: {
        create: {
          id: "seed-profile-a",
          subject: "الرياضيات",
          bio: "مدرس رياضيات بخبرة ١٢ سنة في المرحلتين الإعدادية والثانوية",
        },
      },
    },
  });
  console.log(`Teacher A: ${teacherA.fullName}`);

  // Stages — Teacher A
  const stagesA: {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
  }[] = [];
  const stagesAData = [
    {
      name: "الصف الأول الإعدادي",
      description:
        "المنهج الدراسي للصف الأول الإعدادي - الفصل الدراسي الأول والثاني",
    },
    {
      name: "الصف الثاني الإعدادي",
      description: "المنهج الدراسي للصف الثاني الإعدادي - الجبر والهندسة",
    },
    {
      name: "الصف الأول الثانوي",
      description:
        "المنهج الدراسي للصف الأول الثانوي - الجبر والتفاضل وحساب المثلثات",
    },
  ];

  for (let i = 0; i < stagesAData.length; i++) {
    const stage = await prisma.stage.upsert({
      where: { id: `seed-stage-a-${i + 1}` },
      update: {
        name: stagesAData[i]!.name,
        description: stagesAData[i]!.description || null,
        sortOrder: i + 1,
        teacherId: teacherA.id,
      },
      create: {
        id: `seed-stage-a-${i + 1}`,
        name: stagesAData[i]!.name,
        description: stagesAData[i]!.description || null,
        sortOrder: i + 1,
        teacherId: teacherA.id,
      },
    });
    stagesA.push(stage);
  }

  // Chapters & Lessons — Teacher A
  // Stage 1: الصف الأول الإعدادي — 3 chapters
  // Stage 2: الصف الثاني الإعدادي — 4 chapters
  // Stage 3: الصف الأول الثانوي — 3 chapters

  const contentA: {
    stageIdx: number;
    chapterName: string;
    chapterDescription: string;
    price: number | null;
    lessons: {
      title: string;
      description: string;
      durationMinutes: number;
      youtubeUrl: string;
      sortOrder: number;
    }[];
  }[] = [
    // Stage 1 — الصف الأول الإعدادي
    {
      stageIdx: 0,
      chapterName: "الأعداد الطبيعية",
      chapterDescription: "مجموعة الأعداد الطبيعية وخصائصها والعمليات عليها",
      price: null,
      lessons: [
        {
          title: "مقدمة في الأعداد الطبيعية",
          description: "تعريف الأعداد الطبيعية وتمثيلها على خط الأعداد",
          durationMinutes: 20,
          youtubeUrl: "https://www.youtube.com/watch?v=OpaUzT6ha44",
          sortOrder: 1,
        },
        {
          title: "جمع وطرح الأعداد الطبيعية",
          description: "قواعد الجمع والطرح وخصائص الإبدال والتجميع",
          durationMinutes: 30,
          youtubeUrl: "https://www.youtube.com/watch?v=OpaUzT6ha44",
          sortOrder: 2,
        },
        {
          title: "ضرب وقسمة الأعداد الطبيعية",
          description: "جدول الضرب وقواعد القسمة مع التطبيقات",
          durationMinutes: 35,
          youtubeUrl: "https://www.youtube.com/watch?v=OpaUzT6ha44",
          sortOrder: 3,
        },
      ],
    },
    {
      stageIdx: 0,
      chapterName: "الهندسة الأساسية",
      chapterDescription: "المفاهيم الهندسية الأولى والزوايا والمضلعات",
      price: 29.99,
      lessons: [
        {
          title: "النقاط والمستقيمات والقطع المستقيمة",
          description: "المفاهيم الأساسية في الهندسة المستوية",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-4",
          sortOrder: 1,
        },
        {
          title: "الزوايا وأنواعها",
          description: "الزاوية الحادة والقائمة والمنفرجة والمستقيمة",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-5",
          sortOrder: 2,
        },
        {
          title: "المثلثات وتصنيفها",
          description: "تصنيف المثلثات حسب الأضلاع والزوايا",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-6",
          sortOrder: 3,
        },
        {
          title: "محيط ومساحة المربع والمستطيل",
          description: "قوانين حساب المحيط والمساحة مع الأمثلة",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-7",
          sortOrder: 4,
        },
      ],
    },
    {
      stageIdx: 0,
      chapterName: "الإحصاء والاحتمالات",
      chapterDescription: "جمع البيانات وتنظيمها وتمثيلها بيانياً",
      price: null,
      lessons: [
        {
          title: "جمع البيانات وتنظيمها",
          description: "طرق جمع البيانات وإنشاء جداول التكرار",
          durationMinutes: 20,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-8",
          sortOrder: 1,
        },
        {
          title: "تمثيل البيانات بالأعمدة",
          description: "قراءة وإنشاء المخططات بالأعمدة",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-9",
          sortOrder: 2,
        },
        {
          title: "المتوسط الحسابي والوسيط",
          description: "حساب مقاييس النزعة المركزية",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a1-10",
          sortOrder: 3,
        },
      ],
    },
    // Stage 2 — الصف الثاني الإعدادي
    {
      stageIdx: 1,
      chapterName: "التحليل الجبري",
      chapterDescription: "تحليل العبارات الجبرية والعوامل المشتركة",
      price: null,
      lessons: [
        {
          title: "العامل المشترك الأكبر",
          description: "إيجاد العامل المشترك الأكبر لمجموعة حدود",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-1",
          sortOrder: 1,
        },
        {
          title: "تحليل الفرق بين مربعين",
          description: "قانون تحليل المربع الكامل والفرق بين مربعين",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-2",
          sortOrder: 2,
        },
        {
          title: "تحليل المقدار الثلاثي",
          description: "تحليل المقدار الثلاثي البسيط وغير البسيط",
          durationMinutes: 45,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-3",
          sortOrder: 3,
        },
      ],
    },
    {
      stageIdx: 1,
      chapterName: "الهندسة التحليلية",
      chapterDescription: "الإحداثيات والمستقيمات في المستوى الديكارتي",
      price: 39.99,
      lessons: [
        {
          title: "المستوى الإحداثي",
          description: "تمثيل النقاط في المستوى الإحداثي",
          durationMinutes: 20,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-4",
          sortOrder: 1,
        },
        {
          title: "البعد بين نقطتين",
          description: "قانون حساب المسافة بين نقطتين",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-5",
          sortOrder: 2,
        },
        {
          title: "معادلة الخط المستقيم",
          description: "إيجاد معادلة الخط المستقيم بمعلومية نقطتين",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-6",
          sortOrder: 3,
        },
        {
          title: "توازي وتعاود المستقيمات",
          description: "شروط توازي وتعاود مستقيمين في المستوى",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-7",
          sortOrder: 4,
        },
      ],
    },
    {
      stageIdx: 1,
      chapterName: "النسب المئوية",
      chapterDescription: "حساب النسبة المئوية وتطبيقاتها في الحياة اليومية",
      price: null,
      lessons: [
        {
          title: "مفهوم النسبة المئوية",
          description: "تحويل الكسور إلى نسب مئوية والعكس",
          durationMinutes: 20,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-8",
          sortOrder: 1,
        },
        {
          title: "الربح والخصم",
          description: "حساب الربح والخسارة والخصم في المعاملات التجارية",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-9",
          sortOrder: 2,
        },
        {
          title: "الفائدة البسيطة",
          description: "قانون الفائدة البسيطة وتطبيقاتها",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-10",
          sortOrder: 3,
        },
      ],
    },
    {
      stageIdx: 1,
      chapterName: "الكسور والعمليات عليها",
      chapterDescription: "الكسور الاعتيادية والعشرية والعمليات الحسابية",
      price: null,
      lessons: [
        {
          title: "تبسيط الكسور",
          description: "اختزال الكسور إلى أبسط صورة",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-11",
          sortOrder: 1,
        },
        {
          title: "جمع وطرح الكسور",
          description: "توحيد المقامات وجمع وطرح الكسور",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a2-12",
          sortOrder: 2,
        },
      ],
    },
    // Stage 3 — الصف الأول الثانوي
    {
      stageIdx: 2,
      chapterName: "الجبر والعلاقات",
      chapterDescription: "العلاقات والدوال الجبرية وتمثيلها",
      price: null,
      lessons: [
        {
          title: "العلاقات والدوال",
          description: "تعريف العلاقة والدالة والمجال والمجال المقابل",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-1",
          sortOrder: 1,
        },
        {
          title: "تمثيل الدوال بيانياً",
          description: "رسم منحنى الدالة في المستوى الإحداثي",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-2",
          sortOrder: 2,
        },
        {
          title: "الدالة الخطية",
          description: "خصائص الدالة الخطية وتمثيلها",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-3",
          sortOrder: 3,
        },
        {
          title: "الدالة التربيعية",
          description: "تمثيل الدالة التربيعية وإيجاد الرأس والمحور",
          durationMinutes: 45,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-4",
          sortOrder: 4,
        },
        {
          title: "حل المعادلات التربيعية",
          description: "طرق حل المعادلات من الدرجة الثانية",
          durationMinutes: 50,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-5",
          sortOrder: 5,
        },
      ],
    },
    {
      stageIdx: 2,
      chapterName: "حساب المثلثات",
      chapterDescription: "النسب المثلثية وقوانين الجيب وجيب التمام",
      price: 49.99,
      lessons: [
        {
          title: "النسب المثلثية الأساسية",
          description: "الجيب وجيب التمام والظل في المثلث القائم",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-6",
          sortOrder: 1,
        },
        {
          title: "قانون الجيب",
          description: "استخدام قانون الجيب في حل المثلثات",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-7",
          sortOrder: 2,
        },
        {
          title: "قانون جيب التمام",
          description: "استخدام قانون جيب التمام لحساب الأضلاع والزوايا",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-8",
          sortOrder: 3,
        },
      ],
    },
    {
      stageIdx: 2,
      chapterName: "التفاضل والتكامل",
      chapterDescription: "مبادئ التفاضل والتكامل ونهايات الدوال",
      price: 59.99,
      lessons: [
        {
          title: "النهايات",
          description: "مفهوم نهاية الدالة وطرق حسابها",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-9",
          sortOrder: 1,
        },
        {
          title: "قواعد الاشتقاق",
          description: "مشتقة الدوال الأساسية وقواعد التفاضل",
          durationMinutes: 50,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-10",
          sortOrder: 2,
        },
        {
          title: "تطبيقات على التفاضل",
          description: "المعدلات الزمنية المرتبطة وخطوط المماس",
          durationMinutes: 45,
          youtubeUrl: "https://youtube.com/watch?v=math-a3-11",
          sortOrder: 3,
        },
      ],
    },
  ];

  for (const item of contentA) {
    const stage = stagesA[item.stageIdx]!;
    const chapterSortOrder =
      contentA.filter((c) => c.stageIdx === item.stageIdx).indexOf(item) + 1;
    const chapter = await prisma.chapter.upsert({
      where: { id: `seed-chapter-a-${stage.sortOrder}-${chapterSortOrder}` },
      update: {
        name: item.chapterName,
        description: item.chapterDescription,
        sortOrder: chapterSortOrder,
        price: item.price,
        stageId: stage.id,
      },
      create: {
        id: `seed-chapter-a-${stage.sortOrder}-${chapterSortOrder}`,
        name: item.chapterName,
        description: item.chapterDescription,
        sortOrder: chapterSortOrder,
        price: item.price,
        stageId: stage.id,
      },
    });

    for (const lesson of item.lessons) {
      await prisma.lesson.upsert({
        where: {
          id: `seed-lesson-a-${stage.sortOrder}-${chapterSortOrder}-${lesson.sortOrder}`,
        },
        update: {
          title: lesson.title,
          description: lesson.description,
          durationMinutes: lesson.durationMinutes,
          youtubeUrl: lesson.youtubeUrl,
          sortOrder: lesson.sortOrder,
          chapterId: chapter.id,
        },
        create: {
          id: `seed-lesson-a-${stage.sortOrder}-${chapterSortOrder}-${lesson.sortOrder}`,
          title: lesson.title,
          description: lesson.description,
          durationMinutes: lesson.durationMinutes,
          youtubeUrl: lesson.youtubeUrl,
          sortOrder: lesson.sortOrder,
          chapterId: chapter.id,
        },
      });
    }
  }
  console.log(
    `Teacher A content: ${stagesA.length} stages, ${contentA.length} chapters, ${contentA.reduce((s, c) => s + c.lessons.length, 0)} lessons`,
  );

  // ─── Teacher B — سارة علي (فيزياء) ────────────────────────────────
  const teacherB = await prisma.user.create({
    data: {
      id: "seed-teacher-b",
      fullName: "سارة علي",
      email: "sara.ali@school.edu",
      mobile: "01110000002",
      password: await bcrypt.hash("Teacher@123456", 10),
      role: Role.OPERATION,
      teacherProfile: {
        create: {
          id: "seed-profile-b",
          subject: "الفيزياء",
          bio: "مدرسة فيزياء متخصصة في تدريس العلوم الفيزيائية للمرحلتين الإعدادية والثانوية",
        },
      },
    },
  });
  console.log(`Teacher B: ${teacherB.fullName}`);

  // Stages — Teacher B
  const stagesB: {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
  }[] = [];
  const stagesBData = [
    {
      name: "الصف الثاني الإعدادي - فيزياء",
      description: "المفاهيم الفيزيائية الأساسية للصف الثاني الإعدادي",
    },
    {
      name: "الصف الأول الثانوي - فيزياء",
      description: "المنهج الدراسي لمادة الفيزياء للصف الأول الثانوي",
    },
  ];

  for (let i = 0; i < stagesBData.length; i++) {
    const stage = await prisma.stage.upsert({
      where: { id: `seed-stage-b-${i + 1}` },
      update: {
        name: stagesBData[i]!.name,
        description: stagesBData[i]!.description || null,
        sortOrder: i + 1,
        teacherId: teacherB.id,
      },
      create: {
        id: `seed-stage-b-${i + 1}`,
        name: stagesBData[i]!.name,
        description: stagesBData[i]!.description || null,
        sortOrder: i + 1,
        teacherId: teacherB.id,
      },
    });
    stagesB.push(stage);
  }

  // Chapters & Lessons — Teacher B
  // Stage 1: الصف الثاني الإعدادي — 2 chapters
  // Stage 2: الصف الأول الثانوي — 3 chapters

  const contentB: {
    stageIdx: number;
    chapterName: string;
    chapterDescription: string;
    price: number | null;
    lessons: {
      title: string;
      description: string;
      durationMinutes: number;
      youtubeUrl: string;
      sortOrder: number;
    }[];
  }[] = [
    // Stage 1 — الصف الثاني الإعدادي - فيزياء
    {
      stageIdx: 0,
      chapterName: "القوى والحركة",
      chapterDescription: "مفهوم القوة والحركة وقوانين نيوتن",
      price: null,
      lessons: [
        {
          title: "مفهوم القوة",
          description: "تعريف القوة ووحدات قياسها وأنواعها",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-1",
          sortOrder: 1,
        },
        {
          title: "قوانين نيوتن للحركة",
          description: "قانون نيوتن الأول والثاني والثالث للحركة",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-2",
          sortOrder: 2,
        },
        {
          title: "الاحتكاك",
          description: "قوة الاحتكاك السكوني والحركي وتطبيقاتها",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-3",
          sortOrder: 3,
        },
        {
          title: "الضغط",
          description: "مفهوم الضغط ووحدته وتطبيقاته في السوائل والغازات",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-4",
          sortOrder: 4,
        },
      ],
    },
    {
      stageIdx: 0,
      chapterName: "الطاقة والشغل",
      chapterDescription: "مفهوم الطاقة والشغل والقدرة وبقاء الطاقة",
      price: 29.99,
      lessons: [
        {
          title: "الشغل",
          description: "مفهوم الشغل المبذول بواسطة قوة ووحدات قياسه",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-5",
          sortOrder: 1,
        },
        {
          title: "الطاقة الحركية وطاقة الوضع",
          description: "الطاقة الحركية وطاقة الوضع الجاذبية والمرونية",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-6",
          sortOrder: 2,
        },
        {
          title: "بقاء الطاقة الميكانيكية",
          description: "قانون حفظ الطاقة الميكانيكية وتطبيقاته",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=phys-b1-7",
          sortOrder: 3,
        },
      ],
    },
    // Stage 2 — الصف الأول الثانوي - فيزياء
    {
      stageIdx: 1,
      chapterName: "الكهرباء الساكنة",
      chapterDescription: "الشحنات الكهربائية والمجال الكهربائي وقانون كولوم",
      price: null,
      lessons: [
        {
          title: "الشحنة الكهربائية",
          description: "مفهوم الشحنة الكهربائية وطرق شحن الأجسام",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-1",
          sortOrder: 1,
        },
        {
          title: "قانون كولوم",
          description: "القوة الكهربائية بين شحنتين نقطيتين",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-2",
          sortOrder: 2,
        },
        {
          title: "المجال الكهربائي",
          description: "مفهوم المجال الكهربائي وخطوط المجال",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-3",
          sortOrder: 3,
        },
      ],
    },
    {
      stageIdx: 1,
      chapterName: "التيار الكهربائي",
      chapterDescription:
        "التيار الكهربائي والمقاومة وقانون أوم والدوائر الكهربائية",
      price: 39.99,
      lessons: [
        {
          title: "التيار الكهربائي وفرق الجهد",
          description: "مفهوم التيار الكهربائي وفرق الجهد ووحدات القياس",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-4",
          sortOrder: 1,
        },
        {
          title: "قانون أوم",
          description: "العلاقة بين الجهد والتيار والمقاومة",
          durationMinutes: 30,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-5",
          sortOrder: 2,
        },
        {
          title: "الدوائر الكهربائية البسيطة",
          description: "توصيل المقاومات على التوالي والتوازي",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-6",
          sortOrder: 3,
        },
        {
          title: "القدرة الكهربائية",
          description: "حساب القدرة الكهربائية المستهلكة في الأجهزة",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-7",
          sortOrder: 4,
        },
        {
          title: "تطبيقات عملية على الدوائر الكهربائية",
          description: "تحليل دوائر كهربائية مركبة وحساب التيار والجهد",
          durationMinutes: 45,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-8",
          sortOrder: 5,
        },
      ],
    },
    {
      stageIdx: 1,
      chapterName: "الضوء والبصريات",
      chapterDescription: "الضوء وخصائصه والانعكاس والانكسار والعدسات",
      price: null,
      lessons: [
        {
          title: "طبيعة الضوء",
          description: "الضوء كموجة كهرومغناطيسية وسرعته",
          durationMinutes: 25,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-9",
          sortOrder: 1,
        },
        {
          title: "الانعكاس والمرايا",
          description: "قوانين الانعكاس والصور في المرايا المستوية والكروية",
          durationMinutes: 35,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-10",
          sortOrder: 2,
        },
        {
          title: "الانكسار والعدسات",
          description: "قانون سنل وتكوين الصور بالعدسات المحدبة والمقعرة",
          durationMinutes: 40,
          youtubeUrl: "https://youtube.com/watch?v=phys-b2-11",
          sortOrder: 3,
        },
      ],
    },
  ];

  for (const item of contentB) {
    const stage = stagesB[item.stageIdx]!;
    const chapterSortOrder =
      contentB.filter((c) => c.stageIdx === item.stageIdx).indexOf(item) + 1;

    const chapter = await prisma.chapter.upsert({
      where: { id: `seed-chapter-b-${stage.sortOrder}-${chapterSortOrder}` },
      update: {
        name: item.chapterName,
        description: item.chapterDescription,
        sortOrder: chapterSortOrder,
        price: item.price,
        stageId: stage.id,
      },
      create: {
        id: `seed-chapter-b-${stage.sortOrder}-${chapterSortOrder}`,
        name: item.chapterName,
        description: item.chapterDescription,
        sortOrder: chapterSortOrder,
        price: item.price,
        stageId: stage.id,
      },
    });

    for (const lesson of item.lessons) {
      await prisma.lesson.upsert({
        where: {
          id: `seed-lesson-b-${stage.sortOrder}-${chapterSortOrder}-${lesson.sortOrder}`,
        },
        update: {
          title: lesson.title,
          description: lesson.description,
          durationMinutes: lesson.durationMinutes,
          youtubeUrl: lesson.youtubeUrl,
          sortOrder: lesson.sortOrder,
          chapterId: chapter.id,
        },
        create: {
          id: `seed-lesson-b-${stage.sortOrder}-${chapterSortOrder}-${lesson.sortOrder}`,
          title: lesson.title,
          description: lesson.description,
          durationMinutes: lesson.durationMinutes,
          youtubeUrl: lesson.youtubeUrl,
          sortOrder: lesson.sortOrder,
          chapterId: chapter.id,
        },
      });
    }
  }

  const totalLessonsB = contentB.reduce((s, c) => s + c.lessons.length, 0);
  console.log(
    `Teacher B content: ${stagesB.length} stages, ${contentB.length} chapters, ${totalLessonsB} lessons`,
  );

  // ─── Student (for testing free/paid access) ─────────────────────────
  const studentUser = await prisma.user.upsert({
    where: { email: "student@school.edu" },
    update: {
      fullName: "طالب تجريبي",
      mobile: "01110000003",
      password: await bcrypt.hash("Student@123456", 10),
      role: Role.STUDENT,
    },
    create: {
      id: "seed-student-1",
      fullName: "طالب تجريبي",
      email: "student@school.edu",
      mobile: "01110000003",
      password: await bcrypt.hash("Student@123456", 10),
      role: Role.STUDENT,
    },
  });
  console.log(`Student: student@school.edu / Student@123456`);

  // Enroll the student in one paid chapter (seed-chapter-a-1-2, price 29.99)
  // to test the "enrolled + paid = access" path.
  const enrollmentStartedAt = new Date();
  const enrollmentExpiresAt = new Date(enrollmentStartedAt);
  enrollmentExpiresAt.setFullYear(enrollmentExpiresAt.getFullYear() + 1);
  await prisma.enrollment.upsert({
    where: {
      studentId_chapterId: {
        studentId: studentUser.id,
        chapterId: "seed-chapter-a-1-2",
      },
    },
    update: { status: "ACTIVE" },
    create: {
      id: "seed-enrollment-a-1-2",
      studentId: studentUser.id,
      chapterId: "seed-chapter-a-1-2",
      status: "ACTIVE",
      enrolledMonth: enrollmentStartedAt.getMonth() + 1,
      enrolledYear: enrollmentStartedAt.getFullYear(),
      price: 29.99,
      paymentMethod: "CASH",
      startedAt: enrollmentStartedAt,
      expiresAt: enrollmentExpiresAt,
    },
  });
  console.log("  Enrolled in seed-chapter-a-1-2 (paid, 29.99 EGP)");

  // ─── Summary ────────────────────────────────────────────────────────
  const stats = {
    users: await prisma.user.count(),
    teachers: await prisma.teacherProfile.count(),
    stages: await prisma.stage.count(),
    chapters: await prisma.chapter.count(),
    lessons: await prisma.lesson.count(),
    enrollments: await prisma.enrollment.count(),
  };

  console.log("\n── Seed Complete ──");
  console.table(stats);
  console.log("\nCredentials:");
  console.log(`  Admin:    ${adminEmail} / ${adminPassword}`);
  console.log(`  Teacher A: ahmed.hassan@school.edu / Teacher@123456`);
  console.log(`  Teacher B: sara.ali@school.edu / Teacher@123456`);
  console.log(`  Student:   student@school.edu / Student@123456`);

  // ═════════════════════════════════════════════════════════════════
  //  STORY-27: Stage, Chapter, Lesson Reorder Test Data
  // ═════════════════════════════════════════════════════════════════

  const reorderEmail = "reorder.test@school.edu";
  const existingReorderUser = await prisma.user.findUnique({
    where: { email: reorderEmail },
  });

  if (!existingReorderUser) {
    console.log("\n── STORY-27 Reorder Test Data ──");

    const randomUUID = crypto.randomUUID.bind(crypto);

    const reorderTeacher = await prisma.user.create({
      data: {
        id: randomUUID(),
        fullName: "Reorder Test Teacher",
        email: reorderEmail,
        mobile: "01110000099",
        password: await bcrypt.hash("Pass@123456", 10),
        role: Role.OPERATION,
        teacherProfile: {
          create: {
            id: randomUUID(),
            subject: "Reorder Testing",
            bio: "Dedicated teacher for reorder API testing",
          },
        },
      },
    });
    console.log(`  Teacher: ${reorderEmail} / Pass@123456`);

    // Stages
    const stageAlpha = await prisma.stage.create({
      data: {
        id: randomUUID(),
        name: "Stage Alpha",
        description: "Reorder test — first stage",
        sortOrder: 1,
        teacherId: reorderTeacher.id,
      },
    });
    console.log(`  "Stage Alpha"   → ${stageAlpha.id}`);

    const stageBeta = await prisma.stage.create({
      data: {
        id: randomUUID(),
        name: "Stage Beta",
        description: "Reorder test — second stage",
        sortOrder: 2,
        teacherId: reorderTeacher.id,
      },
    });
    console.log(`  "Stage Beta"    → ${stageBeta.id}`);

    const stageGamma = await prisma.stage.create({
      data: {
        id: randomUUID(),
        name: "Stage Gamma",
        description: "Reorder test — third stage",
        sortOrder: 3,
        teacherId: reorderTeacher.id,
      },
    });
    console.log(`  "Stage Gamma"   → ${stageGamma.id}`);

    // Chapters — Stage Alpha (3 chapters)
    const chA1 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Alpha Chapter One",
        description: "First chapter of Stage Alpha",
        sortOrder: 1,
        stageId: stageAlpha.id,
      },
    });
    const chA2 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Alpha Chapter Two",
        description: "Second chapter of Stage Alpha",
        sortOrder: 2,
        stageId: stageAlpha.id,
      },
    });
    const chA3 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Alpha Chapter Three",
        description: "Third chapter of Stage Alpha",
        sortOrder: 3,
        stageId: stageAlpha.id,
      },
    });

    console.log(`  "Alpha Chapter One"   → ${chA1.id}`);
    console.log(`  "Alpha Chapter Two"   → ${chA2.id}`);
    console.log(`  "Alpha Chapter Three" → ${chA3.id}`);

    // Chapters — Stage Beta (2 chapters)
    const chB1 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Beta Chapter One",
        description: "First chapter of Stage Beta",
        sortOrder: 1,
        stageId: stageBeta.id,
      },
    });
    const chB2 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Beta Chapter Two",
        description: "Second chapter of Stage Beta",
        sortOrder: 2,
        stageId: stageBeta.id,
      },
    });

    console.log(`  "Beta Chapter One"   → ${chB1.id}`);
    console.log(`  "Beta Chapter Two"   → ${chB2.id}`);

    // Chapters — Stage Gamma (2 chapters)
    const chG1 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Gamma Chapter One",
        description: "First chapter of Stage Gamma",
        sortOrder: 1,
        stageId: stageGamma.id,
      },
    });
    const chG2 = await prisma.chapter.create({
      data: {
        id: randomUUID(),
        name: "Gamma Chapter Two",
        description: "Second chapter of Stage Gamma",
        sortOrder: 2,
        stageId: stageGamma.id,
      },
    });

    console.log(`  "Gamma Chapter One" → ${chG1.id}`);
    console.log(`  "Gamma Chapter Two" → ${chG2.id}`);

    // Lessons
    const makeLesson = async (
      chapterId: string,
      title: string,
      sortOrder: number,
    ) =>
      prisma.lesson.create({
        data: {
          id: randomUUID(),
          title,
          description: "Reorder test lesson",
          durationMinutes: 15,
          sortOrder,
          chapterId,
        },
      });

    // Alpha Chapter 1 — 2 lessons
    await makeLesson(chA1.id, "Alpha Ch1 Lesson One", 1);
    await makeLesson(chA1.id, "Alpha Ch1 Lesson Two", 2);
    // Alpha Chapter 2 — 3 lessons
    await makeLesson(chA2.id, "Alpha Ch2 Lesson One", 1);
    await makeLesson(chA2.id, "Alpha Ch2 Lesson Two", 2);
    await makeLesson(chA2.id, "Alpha Ch2 Lesson Three", 3);
    // Alpha Chapter 3 — 2 lessons
    await makeLesson(chA3.id, "Alpha Ch3 Lesson One", 1);
    await makeLesson(chA3.id, "Alpha Ch3 Lesson Two", 2);
    // Beta Chapter 1 — 2 lessons
    await makeLesson(chB1.id, "Beta Ch1 Lesson One", 1);
    await makeLesson(chB1.id, "Beta Ch1 Lesson Two", 2);
    // Beta Chapter 2 — 3 lessons
    await makeLesson(chB2.id, "Beta Ch2 Lesson One", 1);
    await makeLesson(chB2.id, "Beta Ch2 Lesson Two", 2);
    await makeLesson(chB2.id, "Beta Ch2 Lesson Three", 3);
    // Gamma Chapter 1 — 2 lessons
    await makeLesson(chG1.id, "Gamma Ch1 Lesson One", 1);
    await makeLesson(chG1.id, "Gamma Ch1 Lesson Two", 2);
    // Gamma Chapter 2 — 2 lessons
    await makeLesson(chG2.id, "Gamma Ch2 Lesson One", 1);
    await makeLesson(chG2.id, "Gamma Ch2 Lesson Two", 2);

    console.log("  → 15 reorder lessons created");
    console.log("── STORY-27 Setup Complete ──");
  } else {
    console.log("STORY-27 reorder data already exists — skipping.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
