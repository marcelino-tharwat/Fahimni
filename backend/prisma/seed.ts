import "dotenv/config";
import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";

import { TEACHER_PLANS } from "../src/modules/teacher-plans/teacher-plan.seed-data.js";
import type { Prisma } from "../src/generated/prisma/client.js";

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Fahimni@123456";
const DEMO_EMAIL_DOMAIN = "@fahimni.local";
const DEMO_ORDER_PREFIX = "DEMO_";
const DEMO_REF_PREFIX = "DEMO_";

const SEED_NAMESPACE = "f5a0b1c2-d3e4-4f6a-a8bc-9d0e1f2a3b4c";
function sid(key: string): string {
  return uuidv5(`fahimni-seed:${key}`, SEED_NAMESPACE);
}

const now = new Date();
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const daysFromNow = (d: number) =>
  new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

const ADMIN = {
  id: sid("admin"),
  email: "admin" + DEMO_EMAIL_DOMAIN,
  fullName: "مدير المنصة — حساب تجريبي",
  mobile: "01000000001",
  role: "ADMIN" as const,
};

const TEACHERS = [
  {
    id: sid("teacher-math"),
    email: "teacher.math" + DEMO_EMAIL_DOMAIN,
    fullName: "أ. أحمد الرياضي",
    mobile: "01000000010",
    role: "OPERATION" as const,
    profileId: sid("profile-math"),
    subject: "الرياضيات",
    bio: "أستاذ رياضيات للمرحلة الثانوية — خبرة ١٠ سنوات في تدريس الرياضيات.",
  },
  {
    id: sid("teacher-physics"),
    email: "teacher.physics" + DEMO_EMAIL_DOMAIN,
    fullName: "أ. فيصل الفيزيائي",
    mobile: "01000000020",
    role: "OPERATION" as const,
    profileId: sid("profile-physics"),
    subject: "الفيزياء",
    bio: "أستاذ فيزياء — متخصص في تدريس الفيزياء للثانوية العامة.",
  },
  {
    id: sid("teacher-chemistry"),
    email: "teacher.chemistry" + DEMO_EMAIL_DOMAIN,
    fullName: "أ. محمود الكيميائي",
    mobile: "01000000030",
    role: "OPERATION" as const,
    profileId: sid("profile-chemistry"),
    subject: "الكيمياء",
    bio: "أستاذ كيمياء — خبرة في تدريس الكيمياء العضوية وغير العضوية.",
  },
];

const STUDENTS = [
  {
    id: sid("student-active1"),
    email: "student.active1" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب نشط ١",
    mobile: "01000000101",
    role: "STUDENT" as const,
    profileId: sid("profile-active1"),
  },
  {
    id: sid("student-active2"),
    email: "student.active2" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب نشط ٢",
    mobile: "01000000102",
    role: "STUDENT" as const,
    profileId: sid("profile-active2"),
  },
  {
    id: sid("student-pending"),
    email: "student.pending" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب معلق",
    mobile: "01000000103",
    role: "STUDENT" as const,
    profileId: sid("profile-pending"),
  },
  {
    id: sid("student-unassigned"),
    email: "student.unassigned" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب بدون معلم",
    mobile: "01000000104",
    role: "STUDENT" as const,
    profileId: sid("profile-unassigned"),
  },
  {
    id: sid("student-no-enrollment"),
    email: "student.no-enrollment" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب بدون تسجيل",
    mobile: "01000000105",
    role: "STUDENT" as const,
    profileId: sid("profile-no-enrollment"),
  },
  {
    id: sid("student-multi"),
    email: "student.multi-teacher" + DEMO_EMAIL_DOMAIN,
    fullName: "طالب متعدد المعلمين",
    mobile: "01000000106",
    role: "STUDENT" as const,
    profileId: sid("profile-multi"),
  },
];

type StageDef = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  teacherIdx: number;
};

type ChapterDef = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  stageId: string;
  price: number | null;
  teacherIdx: number;
};

type LessonDef = {
  id: string;
  title: string;
  chapterId: string;
  sortOrder: number;
  durationMinutes: number;
};

const STAGES: StageDef[] = [
  {
    id: sid("stage-math"),
    name: "الرياضيات للصف الثالث الثانوي",
    description:
      "منهج الرياضيات للصف الثالث الثانوي — الجبر والتفاضل وحساب المثلثات.",
    sortOrder: 1,
    teacherIdx: 0,
  },
  {
    id: sid("stage-physics"),
    name: "الفيزياء للصف الثالث الثانوي",
    description: "منهج الفيزياء للصف الثالث الثانوي — الميكانيكا والكهرباء.",
    sortOrder: 1,
    teacherIdx: 1,
  },
  {
    id: sid("stage-chemistry"),
    name: "الكيمياء للصف الثالث الثانوي",
    description:
      "منهج الكيمياء للصف الثالث الثانوي — الكيمياء العامة والعضوية.",
    sortOrder: 1,
    teacherIdx: 2,
  },
];

const CHAPTERS: ChapterDef[] = [
  {
    id: sid("ch-math-1"),
    name: "الجبر — الدوال والمتباينات",
    description: "دراسة الدوال الجبرية وأنواعها وحل المتباينات.",
    sortOrder: 1,
    stageId: STAGES[0]!.id,
    price: null,
    teacherIdx: 0,
  },
  {
    id: sid("ch-math-2"),
    name: "التفاضل — النهايات والاشتقاق",
    description: "النهايات وقواعد الاشتقاق وتطبيقاتها.",
    sortOrder: 2,
    stageId: STAGES[0]!.id,
    price: 150,
    teacherIdx: 0,
  },
  {
    id: sid("ch-physics-1"),
    name: "الميكانيكا — الحركة والقوى",
    description: "قوانين نيوتن للحركة وتطبيقاتها.",
    sortOrder: 1,
    stageId: STAGES[1]!.id,
    price: null,
    teacherIdx: 1,
  },
  {
    id: sid("ch-physics-2"),
    name: "الكهرباء — التيار والدوائر",
    description: "التيار الكهربي وقانون أوم والدوائر.",
    sortOrder: 2,
    stageId: STAGES[1]!.id,
    price: 200,
    teacherIdx: 1,
  },
  {
    id: sid("ch-chem-1"),
    name: "الكيمياء العامة — الذرة والروابط",
    description: "تركيب الذرة والروابط الكيميائية.",
    sortOrder: 1,
    stageId: STAGES[2]!.id,
    price: null,
    teacherIdx: 2,
  },
  {
    id: sid("ch-chem-2"),
    name: "الكيمياء العضوية — الهيدروكربونات",
    description: "المركبات الهيدروكربونية وتفاعلاتها.",
    sortOrder: 2,
    stageId: STAGES[2]!.id,
    price: 150,
    teacherIdx: 2,
  },
];

const LESSONS: LessonDef[] = [];
CHAPTERS.forEach((ch, ci) => {
  for (let li = 0; li < 3; li++) {
    LESSONS.push({
      id: sid(`lesson-${ci}-${li}`),
      title: `درس ${ch.name} — الجزء ${li + 1}`,
      chapterId: ch.id,
      sortOrder: li + 1,
      durationMinutes: 30 + li * 10,
    });
  }
});

const ALL_SEED_USER_IDS = [
  ADMIN.id,
  ...TEACHERS.map((t) => t.id),
  ...STUDENTS.map((s) => s.id),
];

const LEGACY_CHEMISTRY_EMAILS = [
  "admin.chemistry@fahimni.test",
  "teacher.chemistry@fahimni.test",
  "chem.student01@fahimni.test",
  "chem.student02@fahimni.test",
  "chem.student03@fahimni.test",
  "chem.student04@fahimni.test",
  "chem.student05@fahimni.test",
  "chem.student06@fahimni.test",
  "chem.student07@fahimni.test",
  "chem.student08@fahimni.test",
];

const ALL_SEED_EMAILS = [
  ADMIN.email,
  ...TEACHERS.map((t) => t.email),
  ...STUDENTS.map((s) => s.email),
  ...LEGACY_CHEMISTRY_EMAILS,
];

async function cleanupSeedOwnedRecords(): Promise<void> {
  const ownedEmails = ALL_SEED_EMAILS;
  const ownedUserIds = ALL_SEED_USER_IDS;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findMany({
      where: { email: { in: ownedEmails } },
      select: { id: true },
    });
    const ids = [...new Set([...ownedUserIds, ...existing.map((u) => u.id)])];
    if (ids.length === 0) return;

    await tx.quizAttempt.deleteMany({ where: { studentId: { in: ids } } });
    await tx.lessonProgress.deleteMany({ where: { studentId: { in: ids } } });
    await tx.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await tx.paymentTransaction.deleteMany({
      where: { studentId: { in: ids } },
    });
    await tx.aiTutorUsage.deleteMany({ where: { studentId: { in: ids } } });

    const ownedLessons = await tx.lesson.findMany({
      where: { chapter: { stage: { teacherId: { in: ids } } } },
      select: { id: true },
    });
    const lessonIds = ownedLessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      await tx.$executeRaw`DELETE FROM content_chunks WHERE "lessonId" = ANY(${lessonIds}::text[])`;
      await tx.lessonMaterialDownload.deleteMany({
        where: { materialId: { in: lessonIds } },
      });
      await tx.lessonMaterial.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
    }

    await tx.quizLesson.deleteMany({
      where: { quiz: { createdBy: { in: ids } } },
    });
    await tx.question.deleteMany({
      where: { quiz: { createdBy: { in: ids } } },
    });
    await tx.quiz.deleteMany({ where: { createdBy: { in: ids } } });

    await tx.teacherAiUsageEvent.deleteMany({
      where: { teacherId: { in: ids } },
    });
    await tx.teacherSubscriptionPayment.deleteMany({
      where: { teacherId: { in: ids } },
    });
    await tx.teacherSubscriptionRequest.deleteMany({
      where: { teacherId: { in: ids } },
    });
    await tx.teacherSubscription.deleteMany({
      where: { teacherId: { in: ids } },
    });

    await tx.promoCode.deleteMany({
      where: {
        OR: [{ createdById: { in: ids } }, { code: { startsWith: "DEMO" } }],
      },
    });

    const stageIds = STAGES.map((s) => s.id);
    await tx.paymentTransaction.deleteMany({
      where: { chapter: { stageId: { in: stageIds } } },
    });

    await tx.lesson.deleteMany({
      where: { chapter: { stage: { teacherId: { in: ids } } } },
    });
    await tx.chapter.deleteMany({
      where: { stage: { teacherId: { in: ids } } },
    });
    await tx.studentProfile.deleteMany({ where: { userId: { in: ids } } });
    await tx.stage.deleteMany({ where: { teacherId: { in: ids } } });
    await tx.teacherProfile.deleteMany({ where: { userId: { in: ids } } });

    await tx.auditLog.deleteMany({
      where: {
        OR: [{ userId: { in: ids } }, { scopeTeacherId: { in: ids } }],
      },
    });

    await tx.teacherRegistrationRequest.deleteMany({
      where: { publicReference: { startsWith: DEMO_REF_PREFIX } },
    });

    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
}

async function seedAll(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const demoPasswordHash = passwordHash;

  await prisma.$transaction(
    async (tx) => {
      // 1. Upsert Teacher Plans (canonical catalog)
      for (const plan of TEACHER_PLANS) {
        await tx.teacherPlan.upsert({
          where: { code: plan.code },
          update: {
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice ?? undefined,
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
            yearlyPrice: plan.yearlyPrice ?? undefined,
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

      // 2. Create Admin
      await tx.user.upsert({
        where: { email: ADMIN.email },
        update: { status: "ACTIVE", fullName: ADMIN.fullName },
        create: {
          id: ADMIN.id,
          email: ADMIN.email,
          fullName: ADMIN.fullName,
          mobile: ADMIN.mobile,
          password: demoPasswordHash,
          role: ADMIN.role,
          status: "ACTIVE",
        },
      });

      // 3. Create Teachers
      for (let ti = 0; ti < TEACHERS.length; ti++) {
        const t = TEACHERS[ti]!;
        await tx.user.upsert({
          where: { email: t.email },
          update: { status: "ACTIVE", fullName: t.fullName },
          create: {
            id: t.id,
            email: t.email,
            fullName: t.fullName,
            mobile: t.mobile,
            password: demoPasswordHash,
            role: t.role,
            status: "ACTIVE",
          },
        });
        await tx.teacherProfile.upsert({
          where: { userId: t.id },
          update: { subject: t.subject, bio: t.bio },
          create: {
            id: t.profileId,
            userId: t.id,
            subject: t.subject,
            bio: t.bio,
            aiTutorDailyQueryLimit: 30,
          },
        });
      }

      // 4. Create Students
      for (const s of STUDENTS) {
        await tx.user.upsert({
          where: { email: s.email },
          update: { status: "ACTIVE", fullName: s.fullName },
          create: {
            id: s.id,
            email: s.email,
            fullName: s.fullName,
            mobile: s.mobile,
            password: demoPasswordHash,
            role: s.role,
            status: "ACTIVE",
          },
        });
      }

      // 5. Create Stages
      const planFreeId = (await tx.teacherPlan.findUnique({
        where: { code: "FREE" },
        select: { id: true },
      }))!.id;
      const planBasicId = (await tx.teacherPlan.findUnique({
        where: { code: "BASIC" },
        select: { id: true },
      }))!.id;
      const planProId = (await tx.teacherPlan.findUnique({
        where: { code: "PRO" },
        select: { id: true },
      }))!.id;

      for (const st of STAGES) {
        await tx.stage.upsert({
          where: { id: st.id },
          update: {
            name: st.name,
            description: st.description,
            sortOrder: st.sortOrder,
          },
          create: {
            id: st.id,
            name: st.name,
            description: st.description,
            sortOrder: st.sortOrder,
            teacherId: TEACHERS[st.teacherIdx]!.id,
          },
        });
      }

      // 6. Create Chapters
      for (const ch of CHAPTERS) {
        await tx.chapter.upsert({
          where: { id: ch.id },
          update: {
            name: ch.name,
            description: ch.description,
            sortOrder: ch.sortOrder,
            price: ch.price,
          },
          create: {
            id: ch.id,
            name: ch.name,
            description: ch.description,
            sortOrder: ch.sortOrder,
            stageId: ch.stageId,
            price: ch.price,
          },
        });
      }

      // 7. Create Lessons
      for (const l of LESSONS) {
        await tx.lesson.upsert({
          where: { id: l.id },
          update: {
            title: l.title,
            durationMinutes: l.durationMinutes,
            sortOrder: l.sortOrder,
          },
          create: {
            id: l.id,
            title: l.title,
            description: null,
            durationMinutes: l.durationMinutes,
            youtubeUrl: null,
            sortOrder: l.sortOrder,
            chapterId: l.chapterId,
            requiredQuizId: null,
          },
        });
      }

      // 8. Create Student Profiles
      for (const s of STUDENTS) {
        await tx.studentProfile.upsert({
          where: { userId: s.id },
          update: { stageId: STAGES[0]!.id },
          create: {
            id: s.profileId,
            userId: s.id,
            stageId: STAGES[0]!.id,
          },
        });
      }

      // 9. Create Quizzes & Questions
      const quizDefs = [
        {
          id: sid("quiz-math-pub"),
          title: "اختبار الجبر — الدوال",
          chapterId: CHAPTERS[0]!.id,
          status: "PUBLISHED" as const,
          desc: "أسئلة على الدوال الجبرية",
          pub: true,
        },
        {
          id: sid("quiz-math-draft"),
          title: "اختبار التفاضل (مسودة)",
          chapterId: CHAPTERS[1]!.id,
          status: "DRAFT" as const,
          desc: "مسودة اختبار التفاضل",
          pub: false,
        },
        {
          id: sid("quiz-physics-pub"),
          title: "اختبار الميكانيكا",
          chapterId: CHAPTERS[2]!.id,
          status: "PUBLISHED" as const,
          desc: "أسئلة على قوانين نيوتن",
          pub: true,
        },
        {
          id: sid("quiz-physics-draft"),
          title: "اختبار الكهرباء (مسودة)",
          chapterId: CHAPTERS[3]!.id,
          status: "DRAFT" as const,
          desc: "مسودة اختبار الكهرباء",
          pub: false,
        },
        {
          id: sid("quiz-chem-pub"),
          title: "اختبار الكيمياء العامة",
          chapterId: CHAPTERS[4]!.id,
          status: "PUBLISHED" as const,
          desc: "أسئلة على الذرة والروابط",
          pub: true,
        },
        {
          id: sid("quiz-chem-draft"),
          title: "اختبار الكيمياء العضوية (مسودة)",
          chapterId: CHAPTERS[5]!.id,
          status: "DRAFT" as const,
          desc: "مسودة اختبار الكيمياء العضوية",
          pub: false,
        },
      ];

      for (const qd of quizDefs) {
        const teacherId = (() => {
          const ch = CHAPTERS.find((c) => c.id === qd.chapterId)!;
          return TEACHERS[ch.teacherIdx]!.id;
        })();

        await tx.quiz.upsert({
          where: { id: qd.id },
          update: { title: qd.title, status: qd.status },
          create: {
            id: qd.id,
            title: qd.title,
            description: qd.desc,
            chapterId: qd.chapterId,
            contentScope: "CHAPTER",
            sourceScope: "SINGLE_CHAPTER",
            sourceChapterIds: [],
            status: qd.status,
            durationMinutes: 30,
            questionCount: 0,
            totalPoints: 0,
            passingScore: 50,
            createdBy: teacherId,
            publishedAt: qd.pub ? daysAgo(10) : null,
          },
        });

        if (qd.pub) {
          const chNum = CHAPTERS.findIndex((c) => c.id === qd.chapterId) + 1;
          const questions: Prisma.QuestionCreateManyInput[] = [
            {
              id: sid(`q-${qd.id}-1`),
              quizId: qd.id,
              type: "MCQ",
              text: `سؤال اختيار من متعدد — الفصل ${chNum}`,
              options: JSON.parse(
                JSON.stringify(["خيار ١", "خيار ٢", "خيار ٣", "خيار ٤"]),
              ),
              correctAnswer: "خيار ١",
              explanation: `شرح السؤال الأول للفصل ${chNum}.`,
              sortOrder: 1,
              points: 2,
            },
            {
              id: sid(`q-${qd.id}-2`),
              quizId: qd.id,
              type: "TRUE_FALSE",
              text: `سؤال صح/خطأ — الفصل ${chNum}`,
              options: JSON.parse(JSON.stringify(["صح", "خطأ"])),
              correctAnswer: "صح",
              explanation: `شرح السؤال الثاني للفصل ${chNum}.`,
              sortOrder: 2,
              points: 1,
            },
            {
              id: sid(`q-${qd.id}-3`),
              quizId: qd.id,
              type: "ESSAY",
              text: `سؤال مقالي — الفصل ${chNum}`,
              options: [],
              correctAnswer: null,
              explanation: `نموذج إجابة السؤال المقالي للفصل ${chNum}.`,
              sortOrder: 3,
              points: 3,
            },
          ];
          await tx.question.createMany({
            data: questions,
            skipDuplicates: true,
          });
          const qCount = questions.length;
          const tPoints = questions.reduce((s, q) => s + q.points, 0);
          await tx.quiz.update({
            where: { id: qd.id },
            data: { questionCount: qCount, totalPoints: tPoints },
          });
        }
      }

      // 10. Enrollments
      await tx.enrollment.createMany({
        data: [
          {
            id: sid("enroll-active1-ch1"),
            studentId: STUDENTS[0]!.id,
            chapterId: CHAPTERS[0]!.id,
            status: "ACTIVE",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(30),
          },
          {
            id: sid("enroll-active1-ch2"),
            studentId: STUDENTS[0]!.id,
            chapterId: CHAPTERS[1]!.id,
            status: "ACTIVE",
            price: 150,
            paymentMethod: "PAYMOB",
            enrolledAt: daysAgo(25),
          },
          {
            id: sid("enroll-active2-ch1"),
            studentId: STUDENTS[1]!.id,
            chapterId: CHAPTERS[0]!.id,
            status: "ACTIVE",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(20),
          },
          {
            id: sid("enroll-active2-ch3"),
            studentId: STUDENTS[1]!.id,
            chapterId: CHAPTERS[2]!.id,
            status: "ACTIVE",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(15),
          },
          {
            id: sid("enroll-pending-ch1"),
            studentId: STUDENTS[2]!.id,
            chapterId: CHAPTERS[0]!.id,
            status: "PAYMENT_PENDING",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(5),
          },
          {
            id: sid("enroll-unassigned-ch2"),
            studentId: STUDENTS[3]!.id,
            chapterId: CHAPTERS[1]!.id,
            status: "PAYMENT_PENDING",
            price: 150,
            paymentMethod: "PAYMOB",
            enrolledAt: daysAgo(3),
          },
          {
            id: sid("enroll-multi-ch1"),
            studentId: STUDENTS[5]!.id,
            chapterId: CHAPTERS[0]!.id,
            status: "ACTIVE",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(20),
          },
          {
            id: sid("enroll-multi-ch3"),
            studentId: STUDENTS[5]!.id,
            chapterId: CHAPTERS[2]!.id,
            status: "ACTIVE",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(18),
          },
          {
            id: sid("enroll-multi-ch4"),
            studentId: STUDENTS[5]!.id,
            chapterId: CHAPTERS[3]!.id,
            status: "ACTIVE",
            price: 200,
            paymentMethod: "PAYMOB",
            enrolledAt: daysAgo(10),
          },
          {
            id: sid("enroll-active1-ch-deact"),
            studentId: STUDENTS[0]!.id,
            chapterId: CHAPTERS[4]!.id,
            status: "DEACTIVATED",
            price: 0,
            paymentMethod: "FREE",
            enrolledAt: daysAgo(60),
          },
        ],
        skipDuplicates: true,
      });

      // 11. PaymentTransactions (course payments)
      await tx.paymentTransaction.createMany({
        data: [
          {
            id: sid("pt-success-1"),
            studentId: STUDENTS[0]!.id,
            chapterId: CHAPTERS[1]!.id,
            paymobOrderId: DEMO_ORDER_PREFIX + "COURSE_ORD_001",
            paymobTransactionId: DEMO_ORDER_PREFIX + "COURSE_TXN_001",
            amount: 150,
            currency: "EGP",
            status: "SUCCESS",
            createdAt: daysAgo(25),
          },
          {
            id: sid("pt-success-2"),
            studentId: STUDENTS[1]!.id,
            chapterId: CHAPTERS[1]!.id,
            paymobOrderId: DEMO_ORDER_PREFIX + "COURSE_ORD_002",
            paymobTransactionId: DEMO_ORDER_PREFIX + "COURSE_TXN_002",
            amount: 150,
            currency: "EGP",
            status: "SUCCESS",
            createdAt: daysAgo(20),
          },
          {
            id: sid("pt-success-3"),
            studentId: STUDENTS[5]!.id,
            chapterId: CHAPTERS[3]!.id,
            paymobOrderId: DEMO_ORDER_PREFIX + "COURSE_ORD_005",
            paymobTransactionId: DEMO_ORDER_PREFIX + "COURSE_TXN_005",
            amount: 200,
            currency: "EGP",
            status: "SUCCESS",
            createdAt: daysAgo(10),
          },
          {
            id: sid("pt-pending-1"),
            studentId: STUDENTS[2]!.id,
            chapterId: CHAPTERS[1]!.id,
            paymobOrderId: DEMO_ORDER_PREFIX + "COURSE_ORD_003",
            amount: 150,
            currency: "EGP",
            status: "PENDING",
            createdAt: daysAgo(5),
          },
          {
            id: sid("pt-failed-1"),
            studentId: STUDENTS[3]!.id,
            chapterId: CHAPTERS[1]!.id,
            paymobOrderId: DEMO_ORDER_PREFIX + "COURSE_ORD_004",
            amount: 150,
            currency: "EGP",
            status: "FAILED",
            errorMessage: "تم رفض الدفع — بطاقة غير صالحة",
            createdAt: daysAgo(3),
          },
        ],
        skipDuplicates: true,
      });

      // 12. TeacherRegistrationRequests
      await tx.teacherRegistrationRequest.upsert({
        where: { publicReference: DEMO_REF_PREFIX + "REQ_001" },
        update: { status: "PENDING" },
        create: {
          id: sid("req-pending"),
          publicReference: DEMO_REF_PREFIX + "REQ_001",
          fullName: "أ. أحمد المدرس الجديد",
          email: "ahmed.newteacher@example.com",
          mobile: "01000000901",
          subject: "الرياضيات",
          bio: "مدرس رياضيات حديث — خبرة ٣ سنوات.",
          status: "PENDING",
          proofDocuments: [],
        },
      });

      await tx.teacherRegistrationRequest.upsert({
        where: { publicReference: DEMO_REF_PREFIX + "REQ_002" },
        update: { status: "APPROVED" },
        create: {
          id: sid("req-approved"),
          publicReference: DEMO_REF_PREFIX + "REQ_002",
          fullName: "أ. محمد المدرس المعتمد",
          email: "mohamed.approved@example.com",
          mobile: "01000000902",
          subject: "الفيزياء",
          bio: "مدرس فيزياء معتمد — خبرة ٧ سنوات.",
          status: "APPROVED",
          proofDocuments: [],
          reviewedById: ADMIN.id,
          reviewedAt: daysAgo(15),
        },
      });

      await tx.teacherRegistrationRequest.upsert({
        where: { publicReference: DEMO_REF_PREFIX + "REQ_003" },
        update: { status: "REJECTED" },
        create: {
          id: sid("req-rejected"),
          publicReference: DEMO_REF_PREFIX + "REQ_003",
          fullName: "أ. خالد المدرس المرفوض",
          email: "khaled.rejected@example.com",
          mobile: "01000000903",
          subject: "الكيمياء",
          bio: "—",
          status: "REJECTED",
          proofDocuments: [],
          reviewedById: ADMIN.id,
          reviewedAt: daysAgo(10),
          adminNotes:
            "المستندات المقدمة غير مكتملة. يُرجى إعادة التقديم بعد استكمال الأوراق.",
        },
      });

      // 13. Teacher Subscriptions
      const mathTeacherId = TEACHERS[0]!.id;
      const physicsTeacherId = TEACHERS[1]!.id;
      const chemTeacherId = TEACHERS[2]!.id;

      // Math teacher: ACTIVE on PRO
      await tx.teacherSubscription.upsert({
        where: { id: sid("sub-math-pro") },
        update: { status: "ACTIVE" },
        create: {
          id: sid("sub-math-pro"),
          teacherId: mathTeacherId,
          planId: planProId,
          status: "ACTIVE",
          billingInterval: "MONTHLY",
          startedAt: daysAgo(60),
          currentPeriodStart: daysAgo(30),
          currentPeriodEnd: daysFromNow(30),
          trialEndsAt: null,
        },
      });

      // Physics teacher: TRIALING on FREE
      await tx.teacherSubscription.upsert({
        where: { id: sid("sub-physics-free") },
        update: { status: "TRIALING" },
        create: {
          id: sid("sub-physics-free"),
          teacherId: physicsTeacherId,
          planId: planFreeId,
          status: "TRIALING",
          billingInterval: "MONTHLY",
          startedAt: daysAgo(5),
          currentPeriodStart: daysAgo(5),
          currentPeriodEnd: daysFromNow(25),
          trialEndsAt: daysFromNow(10),
        },
      });

      // Chemistry teacher: EXPIRED on BASIC
      await tx.teacherSubscription.upsert({
        where: { id: sid("sub-chem-expired") },
        update: { status: "EXPIRED" },
        create: {
          id: sid("sub-chem-expired"),
          teacherId: chemTeacherId,
          planId: planBasicId,
          status: "EXPIRED",
          billingInterval: "MONTHLY",
          startedAt: daysAgo(90),
          currentPeriodStart: daysAgo(60),
          currentPeriodEnd: daysAgo(30),
          cancelledAt: daysAgo(30),
          trialEndsAt: null,
        },
      });

      // 14. Teacher Subscription Payments
      await tx.teacherSubscriptionPayment.createMany({
        data: [
          {
            id: sid("tsp-success-1"),
            teacherId: mathTeacherId,
            planId: planProId,
            subscriptionId: sid("sub-math-pro"),
            provider: "PAYMOB",
            providerOrderId: DEMO_ORDER_PREFIX + "SUB_ORD_001",
            providerTransactionId: DEMO_ORDER_PREFIX + "SUB_TXN_001",
            amount: 499,
            currency: "EGP",
            billingInterval: "MONTHLY",
            status: "SUCCESS",
            createdAt: daysAgo(60),
          },
          {
            id: sid("tsp-success-2"),
            teacherId: mathTeacherId,
            planId: planProId,
            subscriptionId: sid("sub-math-pro"),
            provider: "PAYMOB",
            providerOrderId: DEMO_ORDER_PREFIX + "SUB_ORD_002",
            providerTransactionId: DEMO_ORDER_PREFIX + "SUB_TXN_002",
            amount: 499,
            currency: "EGP",
            billingInterval: "MONTHLY",
            status: "SUCCESS",
            createdAt: daysAgo(30),
          },
          {
            id: sid("tsp-pending-1"),
            teacherId: physicsTeacherId,
            planId: planBasicId,
            provider: "PAYMOB",
            providerOrderId: DEMO_ORDER_PREFIX + "SUB_ORD_003",
            amount: 199,
            currency: "EGP",
            billingInterval: "MONTHLY",
            status: "PENDING",
            createdAt: daysAgo(2),
          },
          {
            id: sid("tsp-failed-1"),
            teacherId: chemTeacherId,
            planId: planBasicId,
            provider: "PAYMOB",
            providerOrderId: DEMO_ORDER_PREFIX + "SUB_ORD_004",
            amount: 199,
            currency: "EGP",
            billingInterval: "MONTHLY",
            status: "FAILED",
            errorMessage: "رصيد غير كافٍ",
            createdAt: daysAgo(60),
          },
        ],
        skipDuplicates: true,
      });

      // 15. Teacher Subscription Requests
      await tx.teacherSubscriptionRequest.upsert({
        where: { id: sid("tsr-math-approved") },
        update: { status: "APPROVED" },
        create: {
          id: sid("tsr-math-approved"),
          teacherId: mathTeacherId,
          planId: planProId,
          requestedInterval: "MONTHLY",
          status: "APPROVED",
          adminNotes: "تمت الموافقة على طلب الترقية إلى الباقة الاحترافية.",
        },
      });

      await tx.teacherSubscriptionRequest.upsert({
        where: { id: sid("tsr-physics-pending") },
        update: { status: "PENDING" },
        create: {
          id: sid("tsr-physics-pending"),
          teacherId: physicsTeacherId,
          planId: planBasicId,
          requestedInterval: "MONTHLY",
          status: "PENDING",
        },
      });

      await tx.teacherSubscriptionRequest.upsert({
        where: { id: sid("tsr-chem-rejected") },
        update: { status: "REJECTED" },
        create: {
          id: sid("tsr-chem-rejected"),
          teacherId: chemTeacherId,
          planId: planProId,
          requestedInterval: "MONTHLY",
          status: "REJECTED",
          adminNotes:
            "الباقة المميزة غير متاحة حالياً. يُرجى التواصل مع الدعم.",
        },
      });

      // 16. Teacher AI Usage Events
      const usageData = [
        {
          teacherId: mathTeacherId,
          type: "AI_QUIZ_GENERATION" as const,
          units: 3,
          meta: { quizTitle: "اختبار الجبر", questionCount: 10 },
        },
        {
          teacherId: mathTeacherId,
          type: "AI_QUIZ_GENERATION" as const,
          units: 2,
          meta: { quizTitle: "اختبار التفاضل", questionCount: 8 },
        },
        {
          teacherId: mathTeacherId,
          type: "AI_ESSAY_GRADING" as const,
          units: 5,
          meta: { essayCount: 5 },
        },
        {
          teacherId: mathTeacherId,
          type: "AI_ESSAY_GRADING" as const,
          units: 3,
          meta: { essayCount: 3 },
        },
        {
          teacherId: mathTeacherId,
          type: "AI_LESSON_SUMMARY" as const,
          units: 1,
          meta: { lessonTitle: "مفهوم الدالة الخطية" },
        },
        {
          teacherId: physicsTeacherId,
          type: "AI_QUIZ_GENERATION" as const,
          units: 1,
          meta: { quizTitle: "اختبار الميكانيكا", questionCount: 5 },
        },
        {
          teacherId: physicsTeacherId,
          type: "AI_ESSAY_GRADING" as const,
          units: 2,
          meta: { essayCount: 2 },
        },
        {
          teacherId: chemTeacherId,
          type: "AI_QUIZ_GENERATION" as const,
          units: 2,
          meta: { quizTitle: "اختبار الكيمياء العامة", questionCount: 6 },
        },
        {
          teacherId: chemTeacherId,
          type: "AI_ESSAY_GRADING" as const,
          units: 1,
          meta: { essayCount: 1 },
        },
        {
          teacherId: chemTeacherId,
          type: "AI_CONTENT_GENERATION" as const,
          units: 1,
          meta: { contentTitle: "ملخص الروابط الكيميائية" },
        },
      ];

      for (let ui = 0; ui < usageData.length; ui++) {
        const u = usageData[ui]!;
        await tx.teacherAiUsageEvent.upsert({
          where: { id: sid(`usage-${ui}`) },
          update: { units: u.units },
          create: {
            id: sid(`usage-${ui}`),
            teacherId: u.teacherId,
            usageType: u.type,
            units: u.units,
            metadata: u.meta,
            createdAt: daysAgo(ui * 2 + 1),
          },
        });
      }

      // 17. PromoCodes
      await tx.promoCode.upsert({
        where: { code: "DEMO2025" },
        update: { isUsed: false, expiresAt: daysFromNow(365) },
        create: {
          id: sid("promo-active"),
          code: "DEMO2025",
          isUsed: false,
          createdById: ADMIN.id,
          chapterId: CHAPTERS[0]!.id,
          expiresAt: daysFromNow(365),
        },
      });

      await tx.promoCode.upsert({
        where: { code: "DEMO2023" },
        update: { isUsed: false, expiresAt: daysAgo(365) },
        create: {
          id: sid("promo-expired"),
          code: "DEMO2023",
          isUsed: false,
          createdById: ADMIN.id,
          chapterId: CHAPTERS[0]!.id,
          expiresAt: daysAgo(365),
        },
      });

      await tx.promoCode.upsert({
        where: { code: "DEMO1USE" },
        update: {
          isUsed: true,
          usedByStudentId: STUDENTS[0]!.id,
          usedAt: daysAgo(15),
        },
        create: {
          id: sid("promo-used"),
          code: "DEMO1USE",
          isUsed: true,
          createdById: ADMIN.id,
          chapterId: CHAPTERS[0]!.id,
          usedByStudentId: STUDENTS[0]!.id,
          usedAt: daysAgo(15),
        },
      });

      // 18. Quiz Attempts
      const mathPubQuizId = sid("quiz-math-pub");
      const physicsPubQuizId = sid("quiz-physics-pub");
      const chemPubQuizId = sid("quiz-chem-pub");
      const allPubQuizIds = [mathPubQuizId, physicsPubQuizId, chemPubQuizId];

      const attemptDefs = [
        {
          sid: "attempt-active1-math",
          studentId: STUDENTS[0]!.id,
          quizId: mathPubQuizId,
          score: 5,
          total: 6,
          status: "COMPLETED" as const,
          completedAt: daysAgo(20),
        },
        {
          sid: "attempt-active2-math",
          studentId: STUDENTS[1]!.id,
          quizId: mathPubQuizId,
          score: 4,
          total: 6,
          status: "COMPLETED" as const,
          completedAt: daysAgo(15),
        },
        {
          sid: "attempt-active1-physics",
          studentId: STUDENTS[0]!.id,
          quizId: physicsPubQuizId,
          score: 5,
          total: 6,
          status: "COMPLETED" as const,
          completedAt: daysAgo(10),
        },
        {
          sid: "attempt-active2-physics",
          studentId: STUDENTS[1]!.id,
          quizId: physicsPubQuizId,
          score: 3,
          total: 6,
          status: "COMPLETED" as const,
          completedAt: daysAgo(8),
        },
        {
          sid: "attempt-multi-chem",
          studentId: STUDENTS[5]!.id,
          quizId: chemPubQuizId,
          score: 6,
          total: 6,
          status: "GRADED" as const,
          completedAt: daysAgo(5),
        },
        {
          sid: "attempt-active1-chem",
          studentId: STUDENTS[0]!.id,
          quizId: chemPubQuizId,
          score: 2,
          total: 6,
          status: "COMPLETED" as const,
          completedAt: daysAgo(3),
        },
        {
          sid: "attempt-pending-math",
          studentId: STUDENTS[2]!.id,
          quizId: mathPubQuizId,
          score: null,
          total: 6,
          status: "IN_PROGRESS" as const,
          completedAt: null,
        },
      ];

      for (const ad of attemptDefs) {
        const answers = allPubQuizIds.includes(ad.quizId)
          ? {
              answers: [
                { questionIndex: 0, answer: "خيار ١" },
                { questionIndex: 1, answer: "صح" },
              ],
            }
          : {};

        await tx.quizAttempt.upsert({
          where: {
            quizId_studentId: { quizId: ad.quizId, studentId: ad.studentId },
          },
          update: { score: ad.score, status: ad.status },
          create: {
            id: sid(ad.sid),
            quizId: ad.quizId,
            studentId: ad.studentId,
            answers,
            score: ad.score,
            totalPoints: ad.total,
            status: ad.status,
            startedAt: ad.completedAt
              ? new Date(ad.completedAt.getTime() - 30 * 60 * 1000)
              : daysAgo(1),
            completedAt: ad.completedAt,
            durationMinutesSnapshot: 30,
          },
        });
      }

      // 19. AuditLogs
      const auditEntries = [
        {
          id: sid("audit-admin-create"),
          action: "USER_CREATED",
          resourceType: "User",
          resourceId: ADMIN.id,
          details: { role: "ADMIN", email: ADMIN.email },
          userId: ADMIN.id,
          actorType: "SYSTEM",
          actorName: "النظام",
          scopeTeacherId: null,
          createdAt: daysAgo(100),
        },
        {
          id: sid("audit-teacher-req-approved"),
          action: "TEACHER_REQUEST_APPROVED",
          resourceType: "TeacherRegistrationRequest",
          resourceId: sid("req-approved"),
          details: { publicReference: DEMO_REF_PREFIX + "REQ_002" },
          userId: ADMIN.id,
          actorType: "ADMIN",
          actorName: ADMIN.fullName,
          scopeTeacherId: null,
          createdAt: daysAgo(15),
        },
        {
          id: sid("audit-payment-completed"),
          action: "PAYMENT_COMPLETED",
          resourceType: "PaymentTransaction",
          resourceId: sid("pt-success-1"),
          details: { amount: 150, chapterId: CHAPTERS[1]!.id },
          userId: STUDENTS[0]!.id,
          actorType: "SYSTEM",
          actorName: "النظام",
          scopeTeacherId: TEACHERS[0]!.id,
          createdAt: daysAgo(25),
        },
        {
          id: sid("audit-sub-payment"),
          action: "SUBSCRIPTION_PAYMENT_COMPLETED",
          resourceType: "TeacherSubscriptionPayment",
          resourceId: sid("tsp-success-1"),
          details: { amount: 499, planCode: "PRO" },
          userId: mathTeacherId,
          actorType: "SYSTEM",
          actorName: "النظام",
          scopeTeacherId: mathTeacherId,
          createdAt: daysAgo(60),
        },
      ];

      for (const ae of auditEntries) {
        await tx.auditLog.upsert({
          where: { id: ae.id },
          update: { action: ae.action },
          create: ae,
        });
      }

      // 20. LessonProgress records
      for (const studentId of [
        STUDENTS[0]!.id,
        STUDENTS[1]!.id,
        STUDENTS[5]!.id,
      ]) {
        const firstLessonId = LESSONS[0]!.id;
        await tx.lessonProgress.upsert({
          where: { studentId_lessonId: { studentId, lessonId: firstLessonId } },
          update: { completed: true },
          create: {
            id: sid(
              `progress-${studentId.slice(0, 8)}-${firstLessonId.slice(0, 8)}`,
            ),
            studentId,
            lessonId: firstLessonId,
            completed: true,
          },
        });
      }
    },
    { timeout: 60_000 },
  );
}

async function logSeedCounts(): Promise<void> {
  const [
    users,
    teachers,
    students,
    stages,
    chapters,
    lessons,
    quizzesPub,
    quizzesDraft,
    enrollments,
    payments,
    subPayments,
    attempts,
    aiEvents,
    requests,
    subscriptions,
  ] = await Promise.all([
    prisma.user.count({ where: { email: { in: ALL_SEED_EMAILS } } }),
    prisma.user.count({
      where: { email: { in: ALL_SEED_EMAILS }, role: "OPERATION" },
    }),
    prisma.user.count({
      where: { email: { in: ALL_SEED_EMAILS }, role: "STUDENT" },
    }),
    prisma.stage.count({ where: { id: { in: STAGES.map((s) => s.id) } } }),
    prisma.chapter.count({ where: { id: { in: CHAPTERS.map((c) => c.id) } } }),
    prisma.lesson.count({ where: { id: { in: LESSONS.map((l) => l.id) } } }),
    prisma.quiz.count({
      where: {
        id: {
          in: [
            sid("quiz-math-pub"),
            sid("quiz-physics-pub"),
            sid("quiz-chem-pub"),
          ],
        },
      },
    }),
    prisma.quiz.count({
      where: {
        id: {
          in: [
            sid("quiz-math-draft"),
            sid("quiz-physics-draft"),
            sid("quiz-chem-draft"),
          ],
        },
      },
    }),
    prisma.enrollment.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.paymentTransaction.count({
      where: { paymobOrderId: { startsWith: DEMO_ORDER_PREFIX } },
    }),
    prisma.teacherSubscriptionPayment.count({
      where: { providerOrderId: { startsWith: DEMO_ORDER_PREFIX } },
    }),
    prisma.quizAttempt.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.teacherAiUsageEvent.count({
      where: { teacherId: { in: TEACHERS.map((t) => t.id) } },
    }),
    prisma.teacherRegistrationRequest.count({
      where: { publicReference: { startsWith: DEMO_REF_PREFIX } },
    }),
    prisma.teacherSubscription.count({
      where: { teacherId: { in: TEACHERS.map((t) => t.id) } },
    }),
  ]);

  logger.info("seed_counts", {
    users,
    teachers,
    students,
    stages,
    chapters,
    lessons,
    publishedQuizzes: quizzesPub,
    draftQuizzes: quizzesDraft,
    enrollments,
    coursePayments: payments,
    subPayments,
    quizAttempts: attempts,
    aiUsageEvents: aiEvents,
    registrationRequests: requests,
    subscriptions,
  });
}

async function main(): Promise<void> {
  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    productionFlag:
      process.env.ALLOW_PRODUCTION_SEED === "true"
        ? undefined
        : process.env.NODE_ENV,
  });

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  ) {
    throw new Error(
      "Seed aborted: NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=true to override.",
    );
  }

  logger.info("seed_started", {
    environment: process.env.NODE_ENV ?? "development",
    databaseHost: host,
  });

  await cleanupSeedOwnedRecords();
  await seedAll();

  await logSeedCounts();

  logger.info("seed_completed", { status: "success" });
}

main()
  .catch((e) => {
    logger.error("seed_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
