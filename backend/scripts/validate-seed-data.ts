import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  allChemistryChapterIds,
  allChemistryLessonIds,
  buildChemistryLessonCatalog,
  chemistryLessonId,
  CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
} from "../src/seed/chemistry-lesson-catalog.js";
import {
  ALL_CHEMISTRY_QUIZ_IDS,
  buildChemistryQuizCatalog,
  buildQuizLessonLinks,
} from "../src/seed/chemistry-quiz-catalog.js";

/**
 * Read-only validation of Chemistry dev seed data after `npm run db:seed`.
 * Performs no writes. Exits non-zero if any assertion fails.
 */

const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";
const CHEMISTRY_SEED_EMAILS = [
  "admin.chemistry@fahimni.test",
  "teacher.chemistry@fahimni.test",
  "chem.student01@fahimni.test",
  "chem.student02@fahimni.test",
  "chem.student03@fahimni.test",
  "chem.student04@fahimni.test",
  "chem.student05@fahimni.test",
] as const;

let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const PLACEHOLDER_RE =
  /lorem ipsum|test lesson|^\s*aaa\s*$|^\s*dummy\s*$|^\s*sample\s*$|بدون محتوى/i;

async function main(): Promise<void> {
  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });
  console.log(`Validating Chemistry seed on ${host}\n`);

  const lessonIds = allChemistryLessonIds();
  const chapterIds = allChemistryChapterIds();
  const quizIds = ALL_CHEMISTRY_QUIZ_IDS;
  const catalog = buildChemistryLessonCatalog();
  const quizCatalog = buildChemistryQuizCatalog();

  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    select: {
      id: true,
      title: true,
      description: true,
      sortOrder: true,
      chapterId: true,
      requiredQuizId: true,
      youtubeUrl: true,
      durationMinutes: true,
    },
  });

  check("all catalog lessons exist in DB", lessons.length === catalog.length, `${lessons.length}/${catalog.length}`);

  for (const lesson of lessons) {
    check(
      `lesson ${lesson.id} has title`,
      Boolean(lesson.title?.trim()),
    );
    check(
      `lesson ${lesson.id} has rich description`,
      Boolean(lesson.description && lesson.description.length >= 200),
      `${lesson.description?.length ?? 0} chars`,
    );
    check(
      `lesson ${lesson.id} no placeholder content`,
      !PLACEHOLDER_RE.test(lesson.description ?? ""),
    );
    check(
      `lesson ${lesson.id} has sortOrder`,
      typeof lesson.sortOrder === "number" && lesson.sortOrder > 0,
    );
    check(
      `lesson ${lesson.id} has duration`,
      typeof lesson.durationMinutes === "number" && lesson.durationMinutes > 0,
    );
    check(
      `lesson ${lesson.id} has youtubeUrl`,
      Boolean(lesson.youtubeUrl?.startsWith("https://")),
    );
  }

  const sortByChapter = new Map<string, number[]>();
  for (const l of lessons) {
    const arr = sortByChapter.get(l.chapterId) ?? [];
    arr.push(l.sortOrder);
    sortByChapter.set(l.chapterId, arr);
  }
  for (const [chId, orders] of sortByChapter) {
    const unique = new Set(orders);
    check(`chapter ${chId} unique lesson sortOrder`, unique.size === orders.length);
  }

  for (const l of lessons.filter((x) => x.requiredQuizId)) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: l.requiredQuizId! },
      select: { id: true, chapterId: true, status: true },
    });
    check(
      `requiredQuizId ${l.requiredQuizId} exists and published`,
      quiz?.status === "PUBLISHED",
    );
    check(
      `requiredQuizId same chapter as lesson ${l.id}`,
      quiz?.chapterId === l.chapterId,
    );
  }

  const quizLessons = await prisma.quizLesson.findMany({
    where: { quizId: { in: quizIds } },
    include: { quiz: { select: { chapterId: true } }, lesson: { select: { chapterId: true } } },
  });
  check("QuizLesson rows exist for optional quizzes", quizLessons.length >= 3, `${quizLessons.length}`);
  for (const ql of quizLessons) {
    check(
      `QuizLesson quiz=${ql.quizId} lesson=${ql.lessonId} same chapter`,
      ql.quiz.chapterId === ql.lesson.chapterId,
    );
  }

  const expectedLinks = buildQuizLessonLinks();
  check(
    "QuizLesson link count matches catalog",
    quizLessons.length === expectedLinks.length,
    `${quizLessons.length} vs ${expectedLinks.length}`,
  );

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: quizIds } },
    include: { _count: { select: { questions: true } } },
  });
  check("all catalog quizzes exist", quizzes.length === quizCatalog.length);

  for (const quiz of quizzes) {
    if (quiz.status === "PUBLISHED") {
      check(`quiz ${quiz.id} has duration`, (quiz.durationMinutes ?? 0) > 0);
      check(
        `quiz ${quiz.id} has questions`,
        quiz._count.questions >= 1,
        `${quiz._count.questions}`,
      );
    }
  }

  const chapterQuizzes = quizCatalog.filter((q) => q.contentScope === "CHAPTER" && q.status === "PUBLISHED");
  check("chapter-level published quizzes", chapterQuizzes.length >= 4, `${chapterQuizzes.length}`);

  const optionalLessonQuizzes = quizCatalog.filter(
    (q) => q.contentScope === "SELECTED_LESSONS" && q.linkedLessonIds.length === 1,
  );
  check("optional single-lesson quizzes", optionalLessonQuizzes.length >= 1);

  const multiLessonQuizzes = quizCatalog.filter(
    (q) => q.contentScope === "SELECTED_LESSONS" && q.linkedLessonIds.length >= 2,
  );
  check("multi-lesson optional quizzes", multiLessonQuizzes.length >= 1);

  const gateLesson = lessons.find((l) => l.id === chemistryLessonId(0, 0));
  check(
    "ch1 lesson 1 has required gate quiz",
    gateLesson?.requiredQuizId === CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
  );

  for (const chId of chapterIds) {
    const count = await prisma.lesson.count({ where: { chapterId: chId } });
    check(`chapter ${chId} has lessons`, count >= 1, `${count}`);
  }

  for (const email of CHEMISTRY_SEED_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    check(`user ${email} exists`, Boolean(user));
    if (user) {
      const valid = await bcrypt.compare(LOCAL_PASSWORD, user.password);
      check(`user ${email} password hash valid`, valid);
    }
  }

  const s3 = await prisma.user.findUnique({ where: { email: "chem.student03@fahimni.test" } });
  const s4 = await prisma.user.findUnique({ where: { email: "chem.student04@fahimni.test" } });
  const s5 = await prisma.user.findUnique({ where: { email: "chem.student05@fahimni.test" } });
  const ch1L1 = chemistryLessonId(0, 0);

  if (s3 && s4 && s5) {
    const gateAttempts = await prisma.quizAttempt.findMany({
      where: { quizId: CHEMISTRY_REQUIRED_GATE_QUIZ_ID, studentId: { in: [s3.id, s4.id, s5.id] } },
    });
    check(
      "S3 gate pending (no gate attempt)",
      !gateAttempts.some((a) => a.studentId === s3.id),
    );
    const s4Attempt = gateAttempts.find((a) => a.studentId === s4.id);
    check("S4 gate failed", s4Attempt?.status === "GRADED" && (s4Attempt.score ?? 0) < 10);
    const s5Attempt = gateAttempts.find((a) => a.studentId === s5.id);
    check("S5 gate passed", s5Attempt?.status === "GRADED" && (s5Attempt.score ?? 0) >= 10);

    for (const [student, label, completed] of [
      [s3, "S3", true],
      [s4, "S4", true],
      [s5, "S5", true],
    ] as const) {
      const prog = await prisma.lessonProgress.findFirst({
        where: { studentId: student.id, lessonId: ch1L1 },
      });
      check(`${label} ch1-l1 progress completed=${completed}`, prog?.completed === completed);
    }
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
