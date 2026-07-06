import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import { isValidUuid, seedId } from "../src/seed/chemistry-ids.js";
import {
  ALL_QUIZ_IDS,
  buildQuestions,
} from "../src/seed/chemistry-seed.fixtures.js";
import type { Prisma } from "../src/generated/prisma/client.js";

/**
 * Fahimni development seed — هيكل كيمياء فارغ (فصول + دروس بدون محتوى).
 *
 * Deterministic UUID v5 ids, idempotent, demo-only. No quizzes or lesson content.
 */

const BCRYPT_ROUNDS = 12;
const LEGACY_SEED_PREFIX = "seed-chem-";
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

const TEACHER_PLANS = [
  { code: "FREE", name: "free", displayName: "الباقة المجانية", description: "ابدأ رحلتك التعليمية مع الباقة المجانية", monthlyPrice: 0, yearlyPrice: null, isRecommended: false, sortOrder: 0, features: ["إنشاء اختبارات بالذكاء الاصطناعي (محدود)", "تصحيح مقالات بالذكاء الاصطناعي (محدود)", "دروس غير محدودة", "محتوى محمي ضد النسخ", "دعم عبر واتساب"], limits: { aiQuizGenerationsPerMonth: 5, aiEssayGradingsPerMonth: 10, aiContentGenerationsPerMonth: 0, aiLessonSummariesPerMonth: 0, aiQuestionExplanationsPerMonth: 0, maxStudents: 50, maxCourses: 3, maxQuizzes: 20, storageMb: 500, analyticsAccess: false, studentEngagementAnalytics: false, pdfDownloadTracking: true, contentProtection: true, prioritySupport: false } },
  { code: "BASIC", name: "basic", displayName: "الباقة الأساسية", description: "مناسبة للمدرسين الجدد", monthlyPrice: 199, yearlyPrice: 1990, isRecommended: false, sortOrder: 1, features: ["إنشاء اختبارات بالذكاء الاصطناعي", "تصحيح مقالات بالذكاء الاصطناعي", "إنشاء محتوى تعليمي بالذكاء الاصطناعي", "دروس غير محدودة", "تخزين 5 جيجابايت", "محتوى محمي ضد النسخ", "تحليلات أساسية", "دعم عبر واتساب"], limits: { aiQuizGenerationsPerMonth: 30, aiEssayGradingsPerMonth: 100, aiContentGenerationsPerMonth: 10, aiLessonSummariesPerMonth: 10, aiQuestionExplanationsPerMonth: 10, maxStudents: 200, maxCourses: 10, maxQuizzes: 100, storageMb: 5120, analyticsAccess: true, studentEngagementAnalytics: false, pdfDownloadTracking: true, contentProtection: true, prioritySupport: false } },
  { code: "PRO", name: "pro", displayName: "الباقة الاحترافية", description: "مناسبة للمدرسين النشطين", monthlyPrice: 499, yearlyPrice: 4990, isRecommended: true, sortOrder: 2, features: ["إنشاء اختبارات بالذكاء الاصطناعي (غير محدود تقريباً)", "تصحيح مقالات بالذكاء الاصطناعي", "إنشاء محتوى تعليمي بالذكاء الاصطناعي", "ملخصات دروس بالذكاء الاصطناعي", "شروحات ذكية للأسئلة", "دروس غير محدودة", "تخزين 10 جيجابايت", "تحليلات الطلاب", "تحليلات تفاعل الطلاب", "تتبع تحميل PDF", "محتوى محمي ضد النسخ", "العلامة المائية للمحتوى", "دعم أولوية عبر واتساب"], limits: { aiQuizGenerationsPerMonth: 100, aiEssayGradingsPerMonth: 500, aiContentGenerationsPerMonth: 50, aiLessonSummariesPerMonth: 50, aiQuestionExplanationsPerMonth: 50, maxStudents: 500, maxCourses: 20, maxQuizzes: 500, storageMb: 10240, analyticsAccess: true, studentEngagementAnalytics: true, pdfDownloadTracking: true, contentProtection: true, prioritySupport: true } },
  { code: "PREMIUM", name: "premium", displayName: "الباقة المميزة", description: "للأكاديميات الكبرى", monthlyPrice: 999, yearlyPrice: 9990, isRecommended: false, sortOrder: 3, features: ["إنشاء اختبارات بالذكاء الاصطناعي (غير محدود)", "تصحيح مقالات بالذكاء الاصطناعي (غير محدود)", "إنشاء محتوى تعليمي بالذكاء الاصطناعي", "ملخصات دروس بالذكاء الاصطناعي", "شروحات ذكية للأسئلة", "دروس غير محدودة", "تخزين 50 جيجابايت", "عدد غير محدود من الطلاب", "تحليلات الطلاب المتقدمة", "تحليلات تفاعل الطلاب", "تتبع تحميل PDF", "محتوى محمي ضد النسخ", "العلامة المائية للمحتوى", "دعم VIP عبر واتساب"], limits: { aiQuizGenerationsPerMonth: -1, aiEssayGradingsPerMonth: -1, aiContentGenerationsPerMonth: 200, aiLessonSummariesPerMonth: 200, aiQuestionExplanationsPerMonth: 200, maxStudents: -1, maxCourses: 100, maxQuizzes: -1, storageMb: 51200, analyticsAccess: true, studentEngagementAnalytics: true, pdfDownloadTracking: true, contentProtection: true, prioritySupport: true } },
];

const CHEMISTRY_SEED_EMAILS = [
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
] as const;

const ADMIN = {
  id: seedId("admin"),
  email: "admin.chemistry@fahimni.test",
  fullName: "مشرف منصة فهمني (تجريبي)",
  mobile: "01000000001",
  role: "ADMIN" as const,
};
const TEACHER = {
  id: seedId("teacher"),
  email: "teacher.chemistry@fahimni.test",
  fullName: "أ. محمود الكيميائي",
  mobile: "01000000002",
  role: "OPERATION" as const,
};
const STUDENTS = Array.from({ length: 8 }, (_v, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: seedId(`student-${n}`),
    email: `chem.student${n}@fahimni.test`,
    fullName: `طالب كيمياء ${n}`,
    mobile: `0100000${String(1001 + i).padStart(4, "0")}`,
    role: "STUDENT" as const,
  };
});

const STAGE = {
  id: seedId("stage"),
  name: "كيمياء الصف الثالث الثانوي",
  description: "هيكل تجريبي فارغ — أضف المحتوى والاختبارات من لوحة المعلم.",
};

const CHAPTERS = CHEMISTRY_CHAPTER_DEFS.map((c) => ({
  id: c.id,
  name: c.name,
}));

const now = new Date();
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const ALL_CHAPTER_IDS = allChemistryChapterIds();
const ALL_LESSON_IDS = allChemistryLessonIds();
const ALL_SEED_USER_IDS = [ADMIN.id, TEACHER.id, ...STUDENTS.map((s) => s.id)];

async function resolveSeedUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [...CHEMISTRY_SEED_EMAILS] } },
        { id: { in: ALL_SEED_USER_IDS } },
        { id: { startsWith: LEGACY_SEED_PREFIX } },
      ],
    },
    select: { id: true },
  });
  return [...new Set(rows.map((r) => r.id))];
}

async function cleanup(): Promise<void> {
  const seedUserIds = await resolveSeedUserIds();

  logger.info("legacy_cleanup_started", {
    legacyUsersFound: seedUserIds.length,
  });

  const ownedLesson = {
    OR: [
      { id: { in: ALL_LESSON_IDS } },
      { id: { startsWith: LEGACY_SEED_PREFIX } },
      { chapter: { stage: { teacherId: { in: seedUserIds } } } },
    ],
  };
  const ownedChapter = {
    OR: [
      { id: { in: ALL_CHAPTER_IDS } },
      { id: { startsWith: LEGACY_SEED_PREFIX } },
      { stage: { teacherId: { in: seedUserIds } } },
    ],
  };
  const ownedStage = {
    OR: [
      { id: STAGE.id },
      { id: { startsWith: LEGACY_SEED_PREFIX } },
      { teacherId: { in: seedUserIds } },
    ],
  };
  const ownedQuiz = {
    OR: [
      { id: { startsWith: LEGACY_SEED_PREFIX } },
      { createdBy: { in: seedUserIds } },
    ],
  };

  await prisma.$transaction(async (tx) => {
    await tx.quizAttempt.deleteMany({
      where: {
        OR: [
          { id: { startsWith: LEGACY_SEED_PREFIX } },
          { studentId: { in: seedUserIds } },
          { quiz: ownedQuiz },
        ],
      },
    });
    await tx.aiTutorUsage.deleteMany({
      where: { studentId: { in: seedUserIds } },
    });
    await tx.lessonProgress.deleteMany({
      where: {
        OR: [
          { id: { startsWith: LEGACY_SEED_PREFIX } },
          { studentId: { in: seedUserIds } },
          { lesson: ownedLesson },
        ],
      },
    });
    await tx.enrollment.deleteMany({
      where: {
        OR: [
          { id: { startsWith: LEGACY_SEED_PREFIX } },
          { studentId: { in: seedUserIds } },
          { chapter: ownedChapter },
        ],
      },
    });
    await tx.paymentTransaction.deleteMany({
      where: {
        OR: [{ studentId: { in: seedUserIds } }, { chapter: ownedChapter }],
      },
    });
    await tx.lesson.updateMany({
      where: { OR: [{ id: { in: ALL_LESSON_IDS } }, { chapter: ownedChapter }] },
      data: { requiredQuizId: null },
    });
    await tx.question.deleteMany({ where: { quiz: ownedQuiz } });
    await tx.quizLesson.deleteMany({ where: { quiz: ownedQuiz } });
    await tx.quiz.deleteMany({ where: ownedQuiz });
    await tx.$executeRaw`
      DELETE FROM content_chunks WHERE "lessonId" IN (
        SELECT l.id FROM lessons l
        JOIN chapters c ON c.id = l."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE l.id = ANY(${ALL_LESSON_IDS}::text[])
           OR l.id LIKE 'seed-chem-%'
           OR s."teacherId" = ANY(${seedUserIds}::text[])
      )`;
    await tx.lessonMaterialDownload.deleteMany({
      where: {
        OR: [
          { studentId: { in: seedUserIds } },
          { materialId: { in: [...ALL_CHEMISTRY_MATERIAL_IDS] } },
        ],
      },
    });
    await tx.lessonMaterial.deleteMany({ where: { lesson: ownedLesson } });
    await tx.lesson.deleteMany({ where: ownedLesson });
    await tx.promoCode.deleteMany({
      where: {
        OR: [
          { createdById: { in: seedUserIds } },
          { usedByStudentId: { in: seedUserIds } },
        ],
      },
    });
    await tx.chapter.deleteMany({ where: ownedChapter });
    await tx.studentProfile.deleteMany({
      where: {
        OR: [{ userId: { in: seedUserIds } }, { stage: ownedStage }],
      },
    });
    await tx.stage.deleteMany({ where: ownedStage });
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: seedUserIds } },
          { scopeTeacherId: { in: seedUserIds } },
        ],
      },
    });
    await tx.teacherProfile.deleteMany({
      where: { userId: { in: seedUserIds } },
    });
    await tx.user.deleteMany({ where: { id: { in: seedUserIds } } });
  });

  logger.info("legacy_cleanup_completed", {
    legacyUsersRemoved: seedUserIds.length,
  });
}

function validateAllSeedIds(): void {
  for (const id of [
    ADMIN.id,
    TEACHER.id,
    ...STUDENTS.map((s) => s.id),
    STAGE.id,
    ...ALL_CHAPTER_IDS,
    ...ALL_LESSON_IDS,
  ]) {
    if (!isValidUuid(id)) {
      throw new Error(`Invalid seed entity id: ${id}`);
    }
  }
}

async function seed(): Promise<void> {
  validateAllSeedIds();
  const passwordHash = await bcrypt.hash(LOCAL_PASSWORD, BCRYPT_ROUNDS);

  const lessonCatalog = buildChemistryLessonShellCatalog();
  const chapterRows = CHAPTERS.map((c, ci) => ({
    id: c.id,
    name: c.name,
    sortOrder: ci + 1,
    stageId: STAGE.id,
    price: ci === 0 ? null : 150,
  }));
  const lessonRows = lessonCatalog.map((l) => ({
    id: l.id,
    title: l.title,
    description: null,
    durationMinutes: 0,
    youtubeUrl: null,
    sortOrder: l.sortOrder,
    chapterId: l.chapterId,
    requiredQuizId: null,
  }));

  logger.info("seed_insert_started");

  await prisma.$transaction(
    async (tx) => {
      for (const plan of TEACHER_PLANS) {
        await tx.teacherPlan.upsert({
          where: { code: plan.code },
          update: {
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            isRecommended: plan.isRecommended,
            sortOrder: plan.sortOrder,
            features: JSON.stringify(plan.features),
            limits: JSON.stringify(plan.limits),
          },
          create: {
            code: plan.code,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            isRecommended: plan.isRecommended,
            sortOrder: plan.sortOrder,
            features: JSON.stringify(plan.features),
            limits: JSON.stringify(plan.limits),
          },
        });
      }
      logger.info("teacher_plans_seeded", { count: TEACHER_PLANS.length });

      await tx.user.createMany({
        data: [ADMIN, TEACHER, ...STUDENTS].map((u) => ({
          ...u,
          password: passwordHash,
          status: "ACTIVE" as const,
        })),
      });
      await tx.teacherProfile.create({
        data: {
          id: seedId("teacher-profile"),
          userId: TEACHER.id,
          subject: "الكيمياء",
          bio: "أستاذ كيمياء للصف الثالث الثانوي — أضف الدروس والاختبارات من لوحة التحكم.",
          aiTutorDailyQueryLimit: 30,
        },
      });
      await tx.stage.create({
        data: {
          id: STAGE.id,
          name: STAGE.name,
          description: STAGE.description,
          sortOrder: 1,
          teacherId: TEACHER.id,
        },
      });
      await tx.studentProfile.createMany({
        data: STUDENTS.map((s, i) => ({
          id: seedId(`student-profile-${String(i + 1).padStart(2, "0")}`),
          userId: s.id,
          stageId: STAGE.id,
        })),
      });
      await tx.chapter.createMany({ data: chapterRows });
      await tx.lesson.createMany({ data: lessonRows });

      const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
      STUDENTS.forEach((s, i) => {
        const n = String(i + 1).padStart(2, "0");
        enrollments.push({
          id: seedId(`enrollment-student${n}-ch1`),
          studentId: s.id,
          chapterId: CHAPTERS[0]!.id,
          status: "ACTIVE",
          price: 0,
          paymentMethod: "FREE",
          enrolledAt: daysAgo(i < 4 ? 5 + i : 40 + i),
        });
        if (i % 2 === 0) {
          enrollments.push({
            id: seedId(`enrollment-student${n}-ch2`),
            studentId: s.id,
            chapterId: CHAPTERS[1]!.id,
            status: "ACTIVE",
            price: 150,
            paymentMethod: "PROMO",
            enrolledAt: daysAgo(3 + i),
          });
        }
      });
      enrollments.push({
        id: seedId("enrollment-student08-ch3-deact"),
        studentId: STUDENTS[7]!.id,
        chapterId: CHAPTERS[2]!.id,
        status: "DEACTIVATED",
        price: 150,
        paymentMethod: "PAYMOB",
        enrolledAt: daysAgo(60),
      });
      await tx.enrollment.createMany({ data: enrollments });
    },
    { timeout: 30_000 },
  );
}

async function countChemistrySeed(): Promise<Record<string, number>> {
  const userIds = ALL_SEED_USER_IDS;
  const [
    users,
    teachers,
    students,
    stages,
    chapters,
    lessons,
    quizzes,
    questions,
    enrollments,
    attempts,
    progress,
    materials,
    legacyPrefix,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.user.count({
      where: { id: { in: userIds }, role: "OPERATION" },
    }),
    prisma.user.count({
      where: { id: { in: userIds }, role: "STUDENT" },
    }),
    prisma.stage.count({ where: { id: STAGE.id } }),
    prisma.chapter.count({ where: { id: { in: ALL_CHAPTER_IDS } } }),
    prisma.lesson.count({ where: { id: { in: ALL_LESSON_IDS } } }),
    prisma.quiz.count({ where: { createdBy: TEACHER.id } }),
    prisma.question.count({ where: { quiz: { createdBy: TEACHER.id } } }),
    prisma.enrollment.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.quizAttempt.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.lessonProgress.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.lessonMaterial.count({
      where: { lesson: { chapter: { stageId: STAGE.id } } },
    }),
    prisma.question.count({
      where: { id: { startsWith: LEGACY_SEED_PREFIX } },
    }),
  ]);

  return {
    users,
    teachers,
    students,
    stages,
    chapters,
    lessons,
    quizzes,
    questions,
    enrollments,
    attempts,
    progress,
    materials,
    legacyPrefix,
  };
}

async function main(): Promise<void> {
  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  logger.info("seed_started", {
    environment: process.env.NODE_ENV ?? "development",
    databaseHost: host,
  });

  const legacyUsers = await prisma.user.count({
    where: {
      OR: [
        { email: { in: [...CHEMISTRY_SEED_EMAILS] } },
        { id: { startsWith: LEGACY_SEED_PREFIX } },
      ],
    },
  });

  logger.info("legacy_seed_audit", {
    legacyChemistryUsersFound: legacyUsers,
  });

  await cleanup();
  await seed();

  const counts = await countChemistrySeed();
  logger.info("seed_completed", counts);

  if (counts.legacyPrefix > 0) {
    throw new Error(
      `Legacy seed-chem- question ids remain: ${counts.legacyPrefix}`,
    );
  }

  if (counts.quizzes > 0) {
    throw new Error(`Expected zero seed quizzes, found ${counts.quizzes}`);
  }
}

main()
  .catch((e) => {
    logger.error("seed_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
