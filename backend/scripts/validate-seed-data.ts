import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  allChemistryChapterIds,
  allChemistryLessonIds,
  buildChemistryLessonShellCatalog,
} from "../src/seed/chemistry-lesson-catalog.js";
import { seedId } from "../src/seed/chemistry-ids.js";

/**
 * Read-only validation of Chemistry dev seed (empty shell — no quizzes/content).
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
const TEACHER_ID = seedId("teacher");

let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });
  console.log(`Validating Chemistry shell seed on ${host}\n`);

  const lessonIds = allChemistryLessonIds();
  const chapterIds = allChemistryChapterIds();
  const catalog = buildChemistryLessonShellCatalog();

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
    check(`lesson ${lesson.id} has title`, Boolean(lesson.title?.trim()));
    check(
      `lesson ${lesson.id} has no content`,
      !lesson.description?.trim(),
      lesson.description ? `${lesson.description.length} chars` : "empty",
    );
    check(`lesson ${lesson.id} has no youtubeUrl`, lesson.youtubeUrl == null);
    check(`lesson ${lesson.id} has no gate quiz`, lesson.requiredQuizId == null);
    check(
      `lesson ${lesson.id} has sortOrder`,
      typeof lesson.sortOrder === "number" && lesson.sortOrder > 0,
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

  check("no seed quizzes for teacher", (await prisma.quiz.count({ where: { createdBy: TEACHER_ID } })) === 0);
  check("no seed quiz attempts", (await prisma.quizAttempt.count()) === 0);
  check("no lesson materials", (await prisma.lessonMaterial.count()) === 0);

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

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
