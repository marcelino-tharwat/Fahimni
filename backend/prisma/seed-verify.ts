import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { ACCOUNTS, FIXTURES } from "../src/seed/secondary-general.data.js";

/**
 * Read-only verification of the seeded local database (STORY-45 fixtures).
 * Performs no writes. Exits non-zero if any assertion fails.
 */

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function ownerOfChapter(chapterId: string): Promise<string | null> {
  const ch = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { stage: { select: { teacherId: true } } },
  });
  return ch?.stage.teacherId ?? null;
}

async function chunkCount(lessonIds: string[]): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int n FROM content_chunks WHERE "lessonId" = ANY(${lessonIds}::text[])`;
  return rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  // 1. Accounts
  const t1 = await prisma.user.findUnique({ where: { id: ACCOUNTS.teacher1.id } });
  const t2 = await prisma.user.findUnique({ where: { id: ACCOUNTS.teacher2.id } });
  const st = await prisma.user.findUnique({ where: { id: ACCOUNTS.student.id } });
  check("teacher1 OPERATION/active", t1?.role === "OPERATION" && t1?.status === "ACTIVE");
  check("teacher2 OPERATION/active", t2?.role === "OPERATION" && t2?.status === "ACTIVE");
  check("student STUDENT/active", st?.role === "STUDENT" && st?.status === "ACTIVE");
  check("accounts use @local.test emails", [t1, t2, st].every((u) => u?.email.endsWith("@local.test")));

  // 2. Stages — 3 General Secondary for teacher1
  const t1Stages = await prisma.stage.findMany({
    where: { teacherId: ACCOUNTS.teacher1.id, deletedAt: null },
    select: { name: true },
  });
  check("teacher1 has 3 secondary stages", t1Stages.length === 3, `${t1Stages.length}`);

  // 3. No preparatory/primary stages or chapters remain
  const prep = await prisma.stage.count({ where: { name: { contains: "الإعدادي" } } });
  const prepCh = await prisma.chapter.count({ where: { name: { contains: "الإعدادي" } } });
  const legacy = await prisma.user.count({ where: { id: { startsWith: "seed-" } } });
  check("no preparatory stages", prep === 0, `${prep}`);
  check("no preparatory chapters", prepCh === 0, `${prepCh}`);
  check("no legacy seed- users remain", legacy === 0, `${legacy}`);

  // 4-7. Ownership
  const successOwner = await ownerOfChapter(FIXTURES.chapterId);
  const unindexedOwner = await ownerOfChapter(FIXTURES.unindexedChapterId);
  const otherOwner = await ownerOfChapter(FIXTURES.otherTeacherChapterId);
  check("success chapter owned by teacher1", successOwner === ACCOUNTS.teacher1.id);
  check("unindexed chapter owned by teacher1", unindexedOwner === ACCOUNTS.teacher1.id);
  check("other-teacher chapter owned by teacher2", otherOwner === ACCOUNTS.teacher2.id);
  check("cross-teacher ownership differs", successOwner !== otherOwner);

  // 5. success lessons belong to success chapter
  const successLessons = await prisma.lesson.findMany({
    where: { id: { in: [FIXTURES.lessonId1, FIXTURES.lessonId2] } },
    select: { chapterId: true, deletedAt: true },
  });
  check(
    "lessonId1/2 belong to success chapter",
    successLessons.length === 2 && successLessons.every((l) => l.chapterId === FIXTURES.chapterId),
  );

  // 9. unindexed chapter has active lessons
  const unindexedLessons = await prisma.lesson.findMany({
    where: { chapterId: FIXTURES.unindexedChapterId, deletedAt: null },
    select: { id: true },
  });
  check("unindexed chapter has active lessons", unindexedLessons.length > 0, `${unindexedLessons.length}`);

  // 10. unindexed chapter has NO usable chunks
  const unindexedChunks = await chunkCount(unindexedLessons.map((l) => l.id));
  check("unindexed chapter has no chunks", unindexedChunks === 0, `${unindexedChunks}`);

  // 11. success chapter chunks (informational + assert ready if any)
  const successChunks = await chunkCount(FIXTURES.indexLessonIds);
  check("success chapter is RAG-ready (has chunks)", successChunks > 0, `${successChunks} chunks`);

  // 13. no quiz attempts from seeding
  const attempts = await prisma.quizAttempt.count();
  check("no QuizAttempt rows", attempts === 0, `${attempts}`);

  // Counts overview
  const counts = {
    users: await prisma.user.count(),
    stages: await prisma.stage.count(),
    chapters: await prisma.chapter.count(),
    lessons: await prisma.lesson.count(),
  };
  console.log("\nCounts:", JSON.stringify(counts));

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("verify failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
