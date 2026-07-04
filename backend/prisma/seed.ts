import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  isValidUuid,
  seedId,
} from "../src/seed/chemistry-ids.js";
import {
  ALL_CHEMISTRY_QUIZ_IDS,
  buildChemistryQuizCatalog,
  buildQuizLessonLinks,
  chemistryGateQuestionMeta,
} from "../src/seed/chemistry-quiz-catalog.js";
import {
  allChemistryChapterIds,
  allChemistryLessonIds,
  buildChemistryLessonCatalog,
  CHEMISTRY_CHAPTER_DEFS,
  chemistryLessonId,
} from "../src/seed/chemistry-lesson-catalog.js";
import { buildQuestions } from "../src/seed/chemistry-seed.fixtures.js";
import {
  ALL_CHEMISTRY_MATERIAL_IDS,
  buildChemistryLessonMaterials,
  CHEMISTRY_CH1_L1_MATERIAL_A,
  ensureChemistryPdfFixturesInStorage,
  SEED_REAL_PDF_MATERIALS_ENABLED,
} from "../src/seed/chemistry-material-seed.js";
import type { Prisma } from "../src/generated/prisma/client.js";

/**
 * Fahimni development seed — محتوى تجريبي لكيمياء الصف الثالث الثانوي.
 *
 * Deterministic UUID v5 ids, idempotent, demo-only. NOT official curriculum.
 */

const BCRYPT_ROUNDS = 12;
const LEGACY_SEED_PREFIX = "seed-chem-";
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

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

const SEED_PROMO_CODES = ["CHEM2026", "CHEMREV", "ORGDEMO"] as const;

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
  description: "محتوى تجريبي لكيمياء الصف الثالث الثانوي — دروس كاملة مع فيديو واختبارات تدريبية وبوابات تقدم.",
};

const CHAPTERS = CHEMISTRY_CHAPTER_DEFS.map((c) => ({
  id: c.id,
  name: c.name,
  lessons: [...c.lessonTitles],
}));

const now = new Date();
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const utcDate = (d: Date) =>
  new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);

const lessonId = chemistryLessonId;

const ALL_CHAPTER_IDS = allChemistryChapterIds();
const ALL_LESSON_IDS = allChemistryLessonIds();
const ALL_QUIZ_IDS = ALL_CHEMISTRY_QUIZ_IDS;
const ALL_SEED_USER_IDS = [ADMIN.id, TEACHER.id, ...STUDENTS.map((s) => s.id)];

function result(
  questionId: string,
  type: string,
  answer: string,
  r: string,
  awarded: number | null,
  max: number,
  feedback: string | null = null,
) {
  return {
    questionId,
    type,
    answer,
    result: r,
    awardedPoints: awarded,
    maxPoints: max,
    feedback,
  };
}

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
      { id: { in: ALL_QUIZ_IDS } },
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
          { code: { in: [...SEED_PROMO_CODES] } },
          { createdById: { in: seedUserIds } },
          { usedByStudentId: { in: seedUserIds } },
        ],
      },
    });
    await tx.chapter.deleteMany({ where: ownedChapter });
    await tx.studentProfile.deleteMany({
      where: { userId: { in: seedUserIds } },
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
    ...ALL_QUIZ_IDS,
  ]) {
    if (!isValidUuid(id)) {
      throw new Error(`Invalid seed entity id: ${id}`);
    }
  }
}

async function seed(): Promise<void> {
  validateAllSeedIds();
  const passwordHash = await bcrypt.hash(LOCAL_PASSWORD, BCRYPT_ROUNDS);

  const lessonCatalog = buildChemistryLessonCatalog();
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
    description: l.description,
    durationMinutes: l.durationMinutes,
    youtubeUrl: l.youtubeUrl,
    sortOrder: l.sortOrder,
    chapterId: l.chapterId,
  }));
  const lessonsWithRequiredQuiz = lessonCatalog.filter((l) => l.requiredQuizId);
  const quizCatalog = buildChemistryQuizCatalog();
  const quizLessonLinks = buildQuizLessonLinks();

  logger.info("seed_insert_started");

  await prisma.$transaction(
    async (tx) => {
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
          bio: "أستاذ كيمياء للصف الثالث الثانوي — محتوى تجريبي على فهمني.",
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

      for (const quiz of quizCatalog) {
        const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
        await tx.quiz.create({
          data: {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            chapterId: quiz.chapterId,
            contentScope: quiz.contentScope,
            status: quiz.status,
            durationMinutes: quiz.durationMinutes,
            passingScore: quiz.passingScore,
            questionCount: quiz.questions.length,
            totalPoints,
            createdBy: TEACHER.id,
            publishedAt: quiz.status === "PUBLISHED" ? daysAgo(20) : null,
          },
        });
        if (quiz.questions.length > 0) {
          await tx.question.createMany({ data: quiz.questions });
        }
      }

      if (quizLessonLinks.length > 0) {
        await tx.quizLesson.createMany({ data: quizLessonLinks });
      }

      for (const lesson of lessonsWithRequiredQuiz) {
        await tx.lesson.update({
          where: { id: lesson.id },
          data: { requiredQuizId: lesson.requiredQuizId },
        });
      }

      if (SEED_REAL_PDF_MATERIALS_ENABLED) {
        await ensureChemistryPdfFixturesInStorage(TEACHER.id);
        await tx.lessonMaterial.createMany({
          data: buildChemistryLessonMaterials(TEACHER.id),
        });

        const materialDownloadedAt = daysAgo(3);
        await tx.lessonMaterialDownload.create({
          data: {
            id: seedId("material-download-student01-a"),
            studentId: STUDENTS[0]!.id,
            materialId: CHEMISTRY_CH1_L1_MATERIAL_A,
            firstDownloadedAt: materialDownloadedAt,
            lastDownloadedAt: materialDownloadedAt,
          },
        });
      } else {
        logger.info("seed_materials_skipped", {
          reason: "SEED_REAL_PDF_MATERIALS is not true",
        });
      }

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
        if (i % 2 === 0)
          enrollments.push({
            id: seedId(`enrollment-student${n}-ch2`),
            studentId: s.id,
            chapterId: CHAPTERS[1]!.id,
            status: "ACTIVE",
            price: 150,
            paymentMethod: "PROMO",
            enrolledAt: daysAgo(3 + i),
          });
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

      await tx.promoCode.createMany({
        data: [
          {
            id: seedId("promo-chem2026"),
            code: "CHEM2026",
            isUsed: false,
            createdById: TEACHER.id,
            chapterId: CHAPTERS[0]!.id,
            expiresAt: daysAgo(-90),
          },
          {
            id: seedId("promo-chemrev"),
            code: "CHEMREV",
            isUsed: false,
            createdById: TEACHER.id,
            chapterId: CHAPTERS[0]!.id,
            expiresAt: daysAgo(-30),
          },
          {
            id: seedId("promo-orgdemo"),
            code: "ORGDEMO",
            isUsed: true,
            usedByStudentId: STUDENTS[0]!.id,
            usedAt: daysAgo(2),
            createdById: TEACHER.id,
            chapterId: CHAPTERS[0]!.id,
            expiresAt: daysAgo(-30),
          },
        ],
      });

      await tx.lessonProgress.createMany({
        data: [
          // S2 — completed lesson without required gate (ch2 lesson 1)
          {
            id: seedId("lesson-progress-student02-ch2-l1"),
            studentId: STUDENTS[1]!.id,
            lessonId: lessonId(1, 0),
            completed: true,
            updatedAt: daysAgo(2),
          },
          // S3 — completed ch1 lesson 1; required gate quiz not attempted
          {
            id: seedId("lesson-progress-student03-ch1-l1"),
            studentId: STUDENTS[2]!.id,
            lessonId: lessonId(0, 0),
            completed: true,
            updatedAt: daysAgo(3),
          },
          // S4 — completed ch1 lesson 1; required gate failed
          {
            id: seedId("lesson-progress-student04-ch1-l1"),
            studentId: STUDENTS[3]!.id,
            lessonId: lessonId(0, 0),
            completed: true,
            updatedAt: daysAgo(4),
          },
          // S5 — completed ch1 lesson 1; required gate passed
          {
            id: seedId("lesson-progress-student05-ch1-l1"),
            studentId: STUDENTS[4]!.id,
            lessonId: lessonId(0, 0),
            completed: true,
            updatedAt: daysAgo(5),
          },
        ],
      });

      const quiz1 = seedId("quiz-ch1"),
        quiz2 = seedId("quiz-ch2"),
        quiz3 = seedId("quiz-ch3"),
        quiz4 = seedId("quiz-ch4");
      const q1 = buildQuestions(quiz1, 0),
        q2 = buildQuestions(quiz2, 1),
        q3 = buildQuestions(quiz3, 2),
        q4 = buildQuestions(quiz4, 3);
      const attempts: Prisma.QuizAttemptCreateManyInput[] = [];

      attempts.push({
        id: seedId("attempt-in-progress"),
        quizId: quiz1,
        studentId: STUDENTS[0]!.id,
        answers: [] as unknown as Prisma.InputJsonValue,
        score: null,
        totalPoints: q1.reduce((s, x) => s + x.points, 0),
        status: "IN_PROGRESS",
        startedAt: daysAgo(0),
      });

      {
        const ans = q2.map((x) =>
          result(
            x.id,
            x.type,
            x.correctAnswer ?? "",
            x.type === "ESSAY" ? "graded" : "correct",
            x.points,
            x.points,
            x.type === "ESSAY" ? "إجابة نموذجية." : null,
          ),
        );
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        attempts.push({
          id: seedId("attempt-graded-100"),
          quizId: quiz2,
          studentId: STUDENTS[1]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score,
          totalPoints: score,
          status: "GRADED",
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
        });
      }
      const gateMeta = chemistryGateQuestionMeta();
      const gateQuizId = seedId("quiz-ch1-required-gate");

      {
        const ans = [
          result(
            gateMeta.questionId,
            "TRUE_FALSE",
            gateMeta.wrongAnswer,
            "incorrect",
            0,
            10,
          ),
        ];
        attempts.push({
          id: seedId("attempt-gate-failed"),
          quizId: gateQuizId,
          studentId: STUDENTS[3]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score: 0,
          totalPoints: 10,
          status: "GRADED",
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
        });
      }
      {
        const ans = [
          result(
            gateMeta.questionId,
            "TRUE_FALSE",
            gateMeta.correctAnswer,
            "correct",
            10,
            10,
          ),
        ];
        attempts.push({
          id: seedId("attempt-gate-passed"),
          quizId: gateQuizId,
          studentId: STUDENTS[4]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score: 10,
          totalPoints: 10,
          status: "GRADED",
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
        });
      }

      {
        const ans = q3.map((x) =>
          x.type === "ESSAY"
            ? result(
                x.id,
                x.type,
                "إجابة الطالب المقالية بانتظار التصحيح.",
                "pending",
                null,
                x.points,
              )
            : result(
                x.id,
                x.type,
                x.correctAnswer ?? "",
                "correct",
                x.points,
                x.points,
              ),
        );
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q3.reduce((s, x) => s + x.points, 0);
        attempts.push({
          id: seedId("attempt-pending"),
          quizId: quiz3,
          studentId: STUDENTS[6]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score,
          totalPoints: total,
          status: "COMPLETED",
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
        });
      }
      {
        const ans = q3.map((x, k) =>
          x.type === "ESSAY"
            ? result(
                x.id,
                x.type,
                "إجابة الطالب المقالية.",
                "graded",
                Math.ceil(x.points / 2),
                x.points,
                "إجابة جيدة لكنها ناقصة بعض التفاصيل.",
              )
            : result(
                x.id,
                x.type,
                k === 0 ? (x.correctAnswer ?? "") : "خطأ",
                k === 0 ? "correct" : "incorrect",
                k === 0 ? x.points : 0,
                x.points,
              ),
        );
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q3.reduce((s, x) => s + x.points, 0);
        attempts.push({
          id: seedId("attempt-graded-essay"),
          quizId: quiz3,
          studentId: STUDENTS[5]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score,
          totalPoints: total,
          status: "GRADED",
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
        });
      }
      {
        const ans = q4.map((x, k) =>
          x.type === "ESSAY"
            ? result(
                x.id,
                x.type,
                "محاولة.",
                "graded",
                0,
                x.points,
                "يحتاج مراجعة.",
              )
            : result(
                x.id,
                x.type,
                k === 0 ? (x.correctAnswer ?? "") : "خطأ",
                k === 0 ? "correct" : "incorrect",
                k === 0 ? x.points : 0,
                x.points,
              ),
        );
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q4.reduce((s, x) => s + x.points, 0);
        attempts.push({
          id: seedId("attempt-graded-low"),
          quizId: quiz4,
          studentId: STUDENTS[6]!.id,
          answers: ans as unknown as Prisma.InputJsonValue,
          score,
          totalPoints: total,
          status: "GRADED",
          startedAt: daysAgo(7),
          completedAt: daysAgo(7),
        });
      }
      await tx.quizAttempt.createMany({ data: attempts });

      await tx.aiTutorUsage.createMany({
        data: [
          {
            id: seedId("ai-usage-student01"),
            studentId: STUDENTS[0]!.id,
            usageDate: utcDate(now),
            count: 3,
          },
          {
            id: seedId("ai-usage-student02"),
            studentId: STUDENTS[1]!.id,
            usageDate: utcDate(now),
            count: 1,
          },
        ],
      });
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
    promos,
    progress,
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
    prisma.quiz.count({ where: { id: { in: ALL_QUIZ_IDS } } }),
    prisma.question.count({ where: { quizId: { in: ALL_QUIZ_IDS } } }),
    prisma.enrollment.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.quizAttempt.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
    }),
    prisma.promoCode.count({ where: { code: { in: [...SEED_PROMO_CODES] } } }),
    prisma.lessonProgress.count({
      where: { studentId: { in: STUDENTS.map((s) => s.id) } },
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
    promos,
    progress,
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
  const legacyQuestions = await prisma.question.count({
    where: { id: { startsWith: LEGACY_SEED_PREFIX } },
  });

  logger.info("legacy_seed_audit", {
    legacyChemistryUsersFound: legacyUsers,
    legacyChemistryQuestionsFound: legacyQuestions,
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

  const sampleQuestions = await prisma.question.findMany({
    where: { quizId: seedId("quiz-ch2") },
    select: { id: true },
    take: 3,
  });
  for (const q of sampleQuestions) {
    if (!isValidUuid(q.id)) {
      throw new Error(`Seeded question id is not a UUID: ${q.id}`);
    }
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
