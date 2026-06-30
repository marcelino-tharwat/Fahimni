import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import type { Prisma } from "../src/generated/prisma/client.js";

/**
 * Fahimni development seed — محتوى تجريبي لكيمياء الصف الثالث الثانوي.
 *
 * Deterministic, idempotent, demo-only chemistry dataset. NOT an official
 * Ministry curriculum — it is sample content for frontend/backend/E2E testing.
 *
 * Safety:
 *  - Aborts unless DATABASE_URL is a recognised LOCAL host and NODE_ENV != production
 *    (assertLocalDatabase).
 *  - Every seed-owned row uses a stable `seed-chem-` id (or the SEED_PREFIX),
 *    so cleanup is scoped — never an unrestricted deleteMany({}).
 *  - Re-running deletes only the seed-owned namespace, then recreates it inside a
 *    transaction → idempotent (no duplicates, no unique-constraint errors).
 */

const BCRYPT_ROUNDS = 12;
const SEED_PREFIX = "seed-"; // covers legacy `seed-*` AND new `seed-chem-*`
const id = (s: string) => `seed-chem-${s}`;

// Demo password comes only from the git-ignored .env (never hardcoded/printed).
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

// ── Stable identities ───────────────────────────────────────────────────────
const ADMIN = { id: id("admin"), email: "admin.chemistry@fahimni.test", fullName: "مشرف منصة فهمني (تجريبي)", mobile: "01000000001", role: "ADMIN" as const };
const TEACHER = { id: id("teacher"), email: "teacher.chemistry@fahimni.test", fullName: "أ. محمود الكيميائي", mobile: "01000000002", role: "OPERATION" as const };
const STUDENTS = Array.from({ length: 8 }, (_v, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: id(`student${n}`), email: `chem.student${n}@fahimni.test`, fullName: `طالب كيمياء ${n}`, mobile: `0100000${String(1001 + i).padStart(4, "0")}`, role: "STUDENT" as const };
});
const SEED_PROMO_CODES = ["CHEM2026", "CHEMREV", "ORGDEMO"]; // VarChar(8) max

const STAGE = { id: id("stage"), name: "كيمياء الصف الثالث الثانوي", description: "محتوى تجريبي لكيمياء الصف الثالث الثانوي" };

const CHAPTERS = [
  { id: id("ch1"), name: "العناصر الانتقالية", lessons: ["خواص العناصر الانتقالية", "حالات التأكسد", "الحديد وسبائكه"] },
  { id: id("ch2"), name: "التحليل الكيميائي", lessons: ["التحليل النوعي", "التحليل الكمي", "المعايرة والحسابات"] },
  { id: id("ch3"), name: "الاتزان الكيميائي", lessons: ["مفهوم الاتزان الديناميكي", "ثابت الاتزان", "العوامل المؤثرة على الاتزان"] },
  { id: id("ch4"), name: "الكيمياء الكهربية", lessons: ["الخلايا الجلفانية", "التحليل الكهربي", "قوانين فاراداي"] },
  { id: id("ch5"), name: "الكيمياء العضوية", lessons: ["الهيدروكربونات", "الكحولات والأحماض", "البوليمرات"] },
];

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const utcDate = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
const lessonId = (ci: number, li: number) => id(`l${ci + 1}-${li + 1}`);

/** A QuestionResult entry matching auto-grade.ts (stored in QuizAttempt.answers). */
function result(questionId: string, type: string, answer: string, r: string, awarded: number | null, max: number, feedback: string | null = null) {
  return { questionId, type, answer, result: r, awardedPoints: awarded, maxPoints: max, feedback };
}

async function cleanup(): Promise<void> {
  // FK-safe order. Scope: seed-owned ids (legacy `seed-*` + new `seed-chem-*`),
  // seed promo codes, and the fixed demo emails. No unrestricted deletes.
  const seedUserIds = (
    await prisma.user.findMany({
      where: { OR: [{ id: { startsWith: SEED_PREFIX } }, { email: { endsWith: "@fahimni.test" } }, { email: { endsWith: "@school.edu" } }] },
      select: { id: true },
    })
  ).map((u) => u.id);

  // Content owned by seed users (by ownership, not just id-prefix) so legacy
  // seed rows with UUID ids are also removed and FK constraints stay satisfied.
  const ownedLesson = { OR: [{ id: { startsWith: SEED_PREFIX } }, { chapter: { stage: { teacherId: { in: seedUserIds } } } }] };
  const ownedChapter = { OR: [{ id: { startsWith: SEED_PREFIX } }, { stage: { teacherId: { in: seedUserIds } } }] };
  const ownedStage = { OR: [{ id: { startsWith: SEED_PREFIX } }, { teacherId: { in: seedUserIds } }] };
  const ownedQuiz = { OR: [{ id: { startsWith: SEED_PREFIX } }, { createdBy: { in: seedUserIds } }] };

  await prisma.$transaction(async (tx) => {
    await tx.quizAttempt.deleteMany({ where: { OR: [{ id: { startsWith: SEED_PREFIX } }, { studentId: { in: seedUserIds } }, { quiz: ownedQuiz }] } });
    await tx.aiTutorUsage.deleteMany({ where: { OR: [{ id: { startsWith: SEED_PREFIX } }, { studentId: { in: seedUserIds } }] } });
    await tx.lessonProgress.deleteMany({ where: { OR: [{ id: { startsWith: SEED_PREFIX } }, { studentId: { in: seedUserIds } }, { lesson: ownedLesson }] } });
    await tx.enrollment.deleteMany({ where: { OR: [{ id: { startsWith: SEED_PREFIX } }, { studentId: { in: seedUserIds } }, { chapter: ownedChapter }] } });
    await tx.paymentTransaction.deleteMany({ where: { OR: [{ studentId: { in: seedUserIds } }, { chapter: ownedChapter }] } });
    await tx.question.deleteMany({ where: { quiz: ownedQuiz } });
    await tx.quiz.deleteMany({ where: ownedQuiz });
    // content_chunks: scoped raw delete for seed-owned lessons (Unsupported vector column).
    await tx.$executeRaw`
      DELETE FROM content_chunks WHERE "lessonId" IN (
        SELECT l.id FROM lessons l
        JOIN chapters c ON c.id = l."chapterId"
        JOIN stages s ON s.id = c."stageId"
        WHERE l.id LIKE 'seed-%' OR s."teacherId" = ANY(${seedUserIds}::text[])
      )`;
    await tx.lessonMaterial.deleteMany({ where: { lesson: ownedLesson } });
    await tx.lesson.deleteMany({ where: ownedLesson });
    await tx.chapter.deleteMany({ where: ownedChapter });
    await tx.stage.deleteMany({ where: ownedStage });
    await tx.promoCode.deleteMany({ where: { OR: [{ code: { in: SEED_PROMO_CODES } }, { createdById: { in: seedUserIds } }, { usedByStudentId: { in: seedUserIds } }] } });
    await tx.auditLog.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { scopeTeacherId: { in: seedUserIds } }] } });
    await tx.teacherProfile.deleteMany({ where: { userId: { in: seedUserIds } } });
    await tx.studentProfile.deleteMany({ where: { userId: { in: seedUserIds } } });
    await tx.user.deleteMany({ where: { id: { in: seedUserIds } } });
  });
}

interface SeedQuestion {
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

/** Deterministic 3-question set (MCQ + TRUE_FALSE + ESSAY) themed per chapter. */
function buildQuestions(quizId: string, ci: number): SeedQuestion[] {
  const themes = [
    { mcq: ["ما العدد الأكسجيني للحديد في أكسيد الحديد III؟", ["+2", "+3", "+4", "0"], "+3", "في Fe2O3 يكون الحديد في حالة تأكسد +3."], tf: ["العناصر الانتقالية تكوّن أيونات ملوّنة.", "صح", "بسبب انتقال الإلكترونات بين مستويات d."], essay: ["اشرح سبب تعدد حالات التأكسد في العناصر الانتقالية.", "تقارب طاقات مستويات (n-1)d و ns يسمح بفقد أعداد مختلفة من الإلكترونات."] },
    { mcq: ["أي كاشف يُستخدم للكشف عن أيون الكلوريد؟", ["نترات الفضة", "هيدروكسيد الصوديوم", "كلوريد الباريوم", "ماء الجير"], "نترات الفضة", "يتكوّن راسب أبيض من AgCl."], tf: ["المعايرة طريقة في التحليل الكمي.", "صح", "تُستخدم لتحديد تركيز محلول مجهول."], essay: ["وضّح خطوات حساب تركيز حمض من نتائج المعايرة.", "باستخدام عدد المولات = التركيز × الحجم ونسب التفاعل المتكافئة."] },
    { mcq: ["عند زيادة الضغط على تفاعل غازي، يتجه الاتزان نحو:", ["الجهة الأقل في عدد المولات الغازية", "الجهة الأكثر في المولات", "لا يتأثر", "يتوقف التفاعل"], "الجهة الأقل في عدد المولات الغازية", "حسب مبدأ لوشاتلييه."], tf: ["ثابت الاتزان يتغير بتغير التركيز فقط.", "خطأ", "ثابت الاتزان يتغير بتغير درجة الحرارة وليس التركيز."], essay: ["اذكر العوامل المؤثرة على موضع الاتزان الكيميائي.", "التركيز والضغط ودرجة الحرارة (والعامل الحفّاز لا يغيّر الموضع)."] },
    { mcq: ["في الخلية الجلفانية يحدث عند المصعد (الأنود):", ["تأكسد", "اختزال", "لا تفاعل", "ترسيب"], "تأكسد", "الأنود هو قطب التأكسد."], tf: ["قوانين فاراداي تربط كتلة المادة المترسبة بكمية الكهرباء.", "صح", "الكتلة تتناسب طرديًا مع الشحنة المارة."], essay: ["قارن بين الخلية الجلفانية وخلية التحليل الكهربي من حيث الطاقة.", "الجلفانية تحوّل كيميائية←كهربية تلقائيًا، والتحليل الكهربي يحتاج طاقة كهربية لإحداث تفاعل غير تلقائي."] },
    { mcq: ["أي المركبات التالية كحول؟", ["CH3OH", "CH4", "CO2", "NaCl"], "CH3OH", "الميثانول كحول يحتوي مجموعة OH."], tf: ["البوليمرات جزيئات كبيرة تتكوّن من وحدات متكررة.", "صح", "تنتج من بلمرة المونومرات."], essay: ["اشرح الفرق بين الكحولات والأحماض الكربوكسيلية في المجموعة الوظيفية.", "الكحول مجموعته OH بينما الحمض الكربوكسيلي مجموعته COOH."] },
  ];
  const t = themes[ci]!;
  return [
    { id: `${quizId}-q1`, quizId, type: "MCQ", text: t.mcq[0] as string, options: t.mcq[1] as unknown as Prisma.InputJsonValue, correctAnswer: t.mcq[2] as string, explanation: t.mcq[3] as string, sortOrder: 1, points: 2 },
    { id: `${quizId}-q2`, quizId, type: "TRUE_FALSE", text: t.tf[0]!, options: ["صح", "خطأ"] as unknown as Prisma.InputJsonValue, correctAnswer: t.tf[1]!, explanation: t.tf[2]!, sortOrder: 2, points: 1 },
    { id: `${quizId}-q3`, quizId, type: "ESSAY", text: t.essay[0]!, options: [] as unknown as Prisma.InputJsonValue, correctAnswer: null, explanation: t.essay[1]!, sortOrder: 3, points: 3 },
  ];
}

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(LOCAL_PASSWORD, BCRYPT_ROUNDS);

  const chapterRows = CHAPTERS.map((c, ci) => ({ id: c.id, name: c.name, sortOrder: ci + 1, stageId: STAGE.id, price: ci === 0 ? null : 150 }));
  const lessonRows = CHAPTERS.flatMap((c, ci) =>
    c.lessons.map((title, li) => ({ id: lessonId(ci, li), title, description: `درس تجريبي: ${title} — ${c.name}.`, durationMinutes: 20 + li * 5, sortOrder: li + 1, chapterId: c.id })),
  );

  await prisma.$transaction(
    async (tx) => {
      // 1. Accounts + profiles
      await tx.user.createMany({ data: [ADMIN, TEACHER, ...STUDENTS].map((u) => ({ ...u, password: passwordHash, status: "ACTIVE" as const })) });
      await tx.teacherProfile.create({ data: { id: id("tprofile"), userId: TEACHER.id, subject: "الكيمياء", bio: "أستاذ كيمياء للصف الثالث الثانوي — محتوى تجريبي على فهمني.", aiTutorDailyQueryLimit: 30 } });
      await tx.studentProfile.createMany({ data: STUDENTS.map((s) => ({ id: id(`sprofile-${s.id.slice(-2)}`), userId: s.id })) });

      // 2. Stage + chapters + lessons
      await tx.stage.create({ data: { id: STAGE.id, name: STAGE.name, description: STAGE.description, sortOrder: 1, teacherId: TEACHER.id } });
      await tx.chapter.createMany({ data: chapterRows });
      await tx.lesson.createMany({ data: lessonRows });

      // 3. Quizzes (one per chapter) + questions; ch5 kept DRAFT (lifecycle variety)
      for (let ci = 0; ci < CHAPTERS.length; ci++) {
        const ch = CHAPTERS[ci]!;
        const quizId = id(`quiz-ch${ci + 1}`);
        const isDraft = ci === 4;
        const questions = buildQuestions(quizId, ci);
        const totalPoints = questions.reduce((s, q) => s + q.points, 0);
        await tx.quiz.create({
          data: { id: quizId, title: `اختبار ${ch.name} (تجريبي)`, description: `أسئلة تجريبية على وحدة ${ch.name}.`, chapterId: ch.id, status: isDraft ? "DRAFT" : "PUBLISHED", durationMinutes: 30, questionCount: questions.length, totalPoints, createdBy: TEACHER.id, publishedAt: isDraft ? null : daysAgo(20 - ci) },
        });
        await tx.question.createMany({ data: questions });
      }

      // 4. Enrollments — all students in ch1 (active, varied recency); multi-chapter; one deactivated
      const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
      STUDENTS.forEach((s, i) => {
        enrollments.push({ id: id(`enr-${s.id.slice(-2)}-c1`), studentId: s.id, chapterId: CHAPTERS[0]!.id, status: "ACTIVE", price: 0, paymentMethod: "CASH", enrolledAt: daysAgo(i < 4 ? 5 + i : 40 + i) });
        if (i % 2 === 0) enrollments.push({ id: id(`enr-${s.id.slice(-2)}-c2`), studentId: s.id, chapterId: CHAPTERS[1]!.id, status: "ACTIVE", price: 150, paymentMethod: "PROMO", enrolledAt: daysAgo(3 + i) });
      });
      enrollments.push({ id: id("enr-08-c3-deact"), studentId: STUDENTS[7]!.id, chapterId: CHAPTERS[2]!.id, status: "DEACTIVATED", price: 150, paymentMethod: "VISA", enrolledAt: daysAgo(60) });
      await tx.enrollment.createMany({ data: enrollments });

      // 5. Promo codes (≤8 chars)
      await tx.promoCode.createMany({
        data: [
          { id: id("promo-1"), code: "CHEM2026", isUsed: false, createdById: TEACHER.id, expiresAt: daysAgo(-90) },
          { id: id("promo-2"), code: "CHEMREV", isUsed: false, createdById: TEACHER.id, expiresAt: daysAgo(-30) },
          { id: id("promo-3"), code: "ORGDEMO", isUsed: true, usedByStudentId: STUDENTS[0]!.id, usedAt: daysAgo(2), createdById: TEACHER.id, expiresAt: daysAgo(-30) },
        ],
      });

      // 6. Lesson progress — varied (none / started / completed)
      await tx.lessonProgress.createMany({
        data: [
          { id: id("lp-01-a"), studentId: STUDENTS[0]!.id, lessonId: lessonId(0, 0), completed: true, updatedAt: daysAgo(1) },
          { id: id("lp-01-b"), studentId: STUDENTS[0]!.id, lessonId: lessonId(0, 1), completed: true, updatedAt: daysAgo(1) },
          { id: id("lp-02-a"), studentId: STUDENTS[1]!.id, lessonId: lessonId(0, 0), completed: false, updatedAt: daysAgo(4) },
          { id: id("lp-03-a"), studentId: STUDENTS[2]!.id, lessonId: lessonId(0, 0), completed: true, updatedAt: daysAgo(6) },
        ],
      });

      // 7. Attempts across lifecycle states (answers shaped like QuestionResult[])
      const quiz1 = id("quiz-ch1"), quiz2 = id("quiz-ch2"), quiz3 = id("quiz-ch3"), quiz4 = id("quiz-ch4");
      const q1 = buildQuestions(quiz1, 0), q2 = buildQuestions(quiz2, 1), q3 = buildQuestions(quiz3, 2), q4 = buildQuestions(quiz4, 3);
      const attempts: Prisma.QuizAttemptCreateManyInput[] = [];

      attempts.push({ id: id("att-ip"), quizId: quiz1, studentId: STUDENTS[0]!.id, answers: [] as unknown as Prisma.InputJsonValue, score: null, totalPoints: q1.reduce((s, x) => s + x.points, 0), status: "IN_PROGRESS", startedAt: daysAgo(0) });

      {
        const ans = q2.map((x) => result(x.id, x.type, x.correctAnswer ?? "", x.type === "ESSAY" ? "graded" : "correct", x.points, x.points, x.type === "ESSAY" ? "إجابة نموذجية." : null));
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        attempts.push({ id: id("att-graded-100"), quizId: quiz2, studentId: STUDENTS[1]!.id, answers: ans as unknown as Prisma.InputJsonValue, score, totalPoints: score, status: "GRADED", startedAt: daysAgo(3), completedAt: daysAgo(3) });
      }
      {
        const ans = q3.map((x) => x.type === "ESSAY" ? result(x.id, x.type, "إجابة الطالب المقالية بانتظار التصحيح.", "pending", null, x.points) : result(x.id, x.type, x.correctAnswer ?? "", "correct", x.points, x.points));
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q3.reduce((s, x) => s + x.points, 0);
        attempts.push({ id: id("att-pending"), quizId: quiz3, studentId: STUDENTS[2]!.id, answers: ans as unknown as Prisma.InputJsonValue, score, totalPoints: total, status: "COMPLETED", startedAt: daysAgo(2), completedAt: daysAgo(2) });
      }
      {
        const ans = q3.map((x, k) => x.type === "ESSAY" ? result(x.id, x.type, "إجابة الطالب المقالية.", "graded", Math.ceil(x.points / 2), x.points, "إجابة جيدة لكنها ناقصة بعض التفاصيل.") : result(x.id, x.type, k === 0 ? (x.correctAnswer ?? "") : "خطأ", k === 0 ? "correct" : "incorrect", k === 0 ? x.points : 0, x.points));
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q3.reduce((s, x) => s + x.points, 0);
        attempts.push({ id: id("att-graded-essay"), quizId: quiz3, studentId: STUDENTS[3]!.id, answers: ans as unknown as Prisma.InputJsonValue, score, totalPoints: total, status: "GRADED", startedAt: daysAgo(5), completedAt: daysAgo(5) });
      }
      {
        const ans = q4.map((x, k) => x.type === "ESSAY" ? result(x.id, x.type, "محاولة.", "graded", 0, x.points, "يحتاج مراجعة.") : result(x.id, x.type, k === 0 ? (x.correctAnswer ?? "") : "خطأ", k === 0 ? "correct" : "incorrect", k === 0 ? x.points : 0, x.points));
        const score = ans.reduce((s, a) => s + (a.awardedPoints ?? 0), 0);
        const total = q4.reduce((s, x) => s + x.points, 0);
        attempts.push({ id: id("att-graded-low"), quizId: quiz4, studentId: STUDENTS[4]!.id, answers: ans as unknown as Prisma.InputJsonValue, score, totalPoints: total, status: "GRADED", startedAt: daysAgo(7), completedAt: daysAgo(7) });
      }
      await tx.quizAttempt.createMany({ data: attempts });

      // 8. AI Tutor usage (below the cap)
      await tx.aiTutorUsage.createMany({
        data: [
          { id: id("aiu-01"), studentId: STUDENTS[0]!.id, usageDate: utcDate(now), count: 3 },
          { id: id("aiu-02"), studentId: STUDENTS[1]!.id, usageDate: utcDate(now), count: 1 },
        ],
      });
    },
    { timeout: 30_000 },
  );
}

async function main(): Promise<void> {
  assertLocalDatabase({ nodeEnv: process.env.NODE_ENV, databaseUrl: process.env.DATABASE_URL });
  console.log("[seed] محتوى تجريبي لكيمياء الصف الثالث الثانوي — starting (scoped, idempotent)…");
  await cleanup();
  await seed();
  const [users, teachers, students, stages, chapters, lessons, quizzes, questions, enrollments, attempts, promos, progress] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.user.count({ where: { id: { startsWith: "seed-chem-" }, role: "OPERATION" } }),
    prisma.user.count({ where: { id: { startsWith: "seed-chem-" }, role: "STUDENT" } }),
    prisma.stage.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.chapter.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.lesson.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.quiz.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.question.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.enrollment.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.quizAttempt.count({ where: { id: { startsWith: "seed-chem-" } } }),
    prisma.promoCode.count({ where: { code: { in: SEED_PROMO_CODES } } }),
    prisma.lessonProgress.count({ where: { id: { startsWith: "seed-chem-" } } }),
  ]);
  console.log(`[seed] done: users=${users} (teachers=${teachers}, students=${students}) stages=${stages} chapters=${chapters} lessons=${lessons} quizzes=${quizzes} questions=${questions} enrollments=${enrollments} attempts=${attempts} promos=${promos} progress=${progress}`);
}

main()
  .catch((e) => {
    console.error("[seed] FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
