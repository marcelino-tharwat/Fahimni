import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { Role } from "../src/generated/prisma/client.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  ACCOUNTS,
  FIXTURES,
  SEED_VERSION,
  TEACHER1_CHAPTERS,
  TEACHER1_STAGES,
  TEACHER2_CHAPTERS,
  TEACHER2_STAGE,
  type SeedChapter,
} from "../src/seed/secondary-general.data.js";

// bcrypt cost factor — MUST match production (auth.service uses 12).
const BCRYPT_ROUNDS = 12;

// Deterministic local password — sourced ONLY from the git-ignored .env
// (SEED_LOCAL_PASSWORD). It is never hardcoded in any tracked file; the seed
// writes it solely into the git-ignored populated Postman environment.
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD;

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTMAN_DIR = join(__dirname, "..", "postman");

interface Counts {
  inserted: number;
  total: number;
}

function skipped(c: Counts): number {
  return c.total - c.inserted;
}

/** Targeted removal of confirmed legacy seed data (old preparatory dataset). */
async function cleanupLegacySeed(): Promise<number> {
  const legacyEmails = [
    "ahmed.hassan@school.edu",
    "sara.ali@school.edu",
    "student@school.edu",
    "reorder.test@school.edu",
  ];

  const legacyUsers = await prisma.user.findMany({
    where: {
      OR: [{ email: { in: legacyEmails } }, { id: { startsWith: "seed-" } }],
    },
    select: { id: true },
  });
  const userIds = legacyUsers.map((u) => u.id);

  const legacyStages = await prisma.stage.findMany({
    where: {
      OR: [
        ...(userIds.length ? [{ teacherId: { in: userIds } }] : []),
        { id: { startsWith: "seed-" } },
      ],
    },
    select: { id: true },
  });
  const stageIds = legacyStages.map((s) => s.id);

  const legacyChapters = await prisma.chapter.findMany({
    where: {
      OR: [
        ...(stageIds.length ? [{ stageId: { in: stageIds } }] : []),
        { id: { startsWith: "seed-" } },
      ],
    },
    select: { id: true },
  });
  const chapterIds = legacyChapters.map((c) => c.id);

  if (
    userIds.length === 0 &&
    stageIds.length === 0 &&
    chapterIds.length === 0
  ) {
    return 0;
  }

  // Child-first deletes to respect foreign keys (content_chunks cascade on lesson).
  if (userIds.length || chapterIds.length) {
    await prisma.enrollment.deleteMany({
      where: {
        OR: [
          ...(userIds.length ? [{ studentId: { in: userIds } }] : []),
          ...(chapterIds.length ? [{ chapterId: { in: chapterIds } }] : []),
        ],
      },
    });
  }
  if (chapterIds.length) {
    await prisma.lesson.deleteMany({
      where: { chapterId: { in: chapterIds } },
    });
  }
  await prisma.lesson.deleteMany({ where: { id: { startsWith: "seed-" } } });
  if (chapterIds.length) {
    await prisma.chapter.deleteMany({ where: { id: { in: chapterIds } } });
  }
  if (stageIds.length) {
    await prisma.stage.deleteMany({ where: { id: { in: stageIds } } });
  }
  if (userIds.length) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ userId: { in: userIds } }, { scopeTeacherId: { in: userIds } }],
      },
    });
    // promo_codes may not exist in every local DB (schema/DB drift); ignore only
    // the "table does not exist" case so cleanup stays resilient.
    try {
      await prisma.promoCode.deleteMany({
        where: { createdById: { in: userIds } },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2021") throw e;
    }
    const legacyQuizzes = await prisma.quiz.findMany({
      where: { createdBy: { in: userIds } },
      select: { id: true },
    });
    const quizIds = legacyQuizzes.map((q) => q.id);
    if (quizIds.length) {
      try {
        await prisma.quizAttempt.deleteMany({
          where: { quizId: { in: quizIds } },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2021") throw e;
      }
      try {
        await prisma.question.deleteMany({
          where: { quizId: { in: quizIds } },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2021") throw e;
      }
      await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
    }

    await prisma.teacherProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  return userIds.length;
}

async function upsertAccounts(passwordHash: string): Promise<void> {
  // Keep the existing local admin usable without overwriting a real one.
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: "f4500000-0001-4001-8001-000000000001",
      email: adminEmail,
      fullName: process.env.ADMIN_FULL_NAME ?? "System Administrator",
      mobile: process.env.ADMIN_MOBILE ?? "01000000000",
      password: passwordHash,
      role: Role.ADMIN,
      status: "ACTIVE",
    },
  });

  const t1 = ACCOUNTS.teacher1;
  await prisma.user.upsert({
    where: { id: t1.id },
    update: {
      email: t1.email,
      fullName: t1.fullName,
      mobile: t1.mobile,
      password: passwordHash,
      role: Role.OPERATION,
      status: "ACTIVE",
    },
    create: {
      id: t1.id,
      email: t1.email,
      fullName: t1.fullName,
      mobile: t1.mobile,
      password: passwordHash,
      role: Role.OPERATION,
      status: "ACTIVE",
    },
  });
  await prisma.teacherProfile.upsert({
    where: { userId: t1.id },
    update: { subject: t1.subject ?? null },
    create: { id: t1.profileId, userId: t1.id, subject: t1.subject ?? null },
  });

  const t2 = ACCOUNTS.teacher2;
  await prisma.user.upsert({
    where: { id: t2.id },
    update: {
      email: t2.email,
      fullName: t2.fullName,
      mobile: t2.mobile,
      password: passwordHash,
      role: Role.OPERATION,
      status: "ACTIVE",
    },
    create: {
      id: t2.id,
      email: t2.email,
      fullName: t2.fullName,
      mobile: t2.mobile,
      password: passwordHash,
      role: Role.OPERATION,
      status: "ACTIVE",
    },
  });
  await prisma.teacherProfile.upsert({
    where: { userId: t2.id },
    update: { subject: t2.subject ?? null },
    create: { id: t2.profileId, userId: t2.id, subject: t2.subject ?? null },
  });

  const st = ACCOUNTS.student;
  await prisma.user.upsert({
    where: { id: st.id },
    update: {
      email: st.email,
      fullName: st.fullName,
      mobile: st.mobile,
      password: passwordHash,
      role: Role.STUDENT,
      status: "ACTIVE",
    },
    create: {
      id: st.id,
      email: st.email,
      fullName: st.fullName,
      mobile: st.mobile,
      password: passwordHash,
      role: Role.STUDENT,
      status: "ACTIVE",
    },
  });
  await prisma.studentProfile.upsert({
    where: { userId: st.id },
    update: {},
    create: { id: st.profileId, userId: st.id },
  });
}

async function seedRelational(): Promise<{
  stages: Counts;
  chapters: Counts;
  lessons: Counts;
}> {
  const allChapters: SeedChapter[] = [
    ...TEACHER1_CHAPTERS,
    ...TEACHER2_CHAPTERS,
  ];

  const stageRows = [
    ...TEACHER1_STAGES.map((s) => ({ ...s, teacherId: ACCOUNTS.teacher1.id })),
    { ...TEACHER2_STAGE, teacherId: ACCOUNTS.teacher2.id },
  ];

  const chapterRows = allChapters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    sortOrder: c.sortOrder,
    stageId: c.stageId,
    price: c.price ?? null,
  }));

  const lessonRows = allChapters.flatMap((c) =>
    c.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      durationMinutes: l.durationMinutes,
      sortOrder: l.sortOrder,
      chapterId: c.id,
    })),
  );

  const chapterIds = allChapters.map((c) => c.id);
  const lessonIds = allChapters.flatMap((c) => c.lessons.map((l) => l.id));

  // Delete then re-create so prices and other fields refresh on re-seed.
  // Deterministic IDs (f4500...) ensure we never touch user-created content.
  await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: chapterIds } } });

  const stages = await prisma.stage.createMany({
    data: stageRows,
    skipDuplicates: true,
  });
  const chapters = await prisma.chapter.createMany({
    data: chapterRows,
  });
  const lessons = await prisma.lesson.createMany({
    data: lessonRows,
  });

  return {
    stages: { inserted: stages.count, total: stageRows.length },
    chapters: { inserted: chapters.count, total: chapterRows.length },
    lessons: { inserted: lessons.count, total: lessonRows.length },
  };
}

/** AI-ready indexing of the successful chapter's lessons (skips already-indexed). */
async function indexSuccessfulLessons(): Promise<{
  indexed: number;
  skipped: number;
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "SEED_AI_READY=true requires GEMINI_API_KEY to be set for embeddings.",
    );
  }
  const { aiService } = await import("../src/modules/ai/ai.service.js");

  const textById = new Map<string, { title: string; text: string }>();
  for (const c of TEACHER1_CHAPTERS) {
    for (const l of c.lessons)
      textById.set(l.id, { title: l.title, text: l.text });
  }

  let indexed = 0;
  let skip = 0;
  // Sequential (3 lessons) — reuses the shared Gemini client's rate limiting.
  for (const lessonId of FIXTURES.indexLessonIds) {
    const rows = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int n FROM content_chunks WHERE "lessonId" = ${lessonId}`;
    if ((rows[0]?.n ?? 0) > 0) {
      skip++;
      continue;
    }
    const entry = textById.get(lessonId);
    if (!entry) continue;
    await aiService.indexLesson(lessonId, entry.text, {
      seedVersion: SEED_VERSION,
      title: entry.title,
    });
    indexed++;
  }
  return { indexed, skipped: skip };
}

async function chunkCount(lessonIds: string[]): Promise<number> {
  if (lessonIds.length === 0) return 0;
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int n FROM content_chunks WHERE "lessonId" = ANY(${lessonIds}::text[])`;
  return rows[0]?.n ?? 0;
}

function writeArtifacts(ragReady: boolean, localPassword: string): void {
  mkdirSync(POSTMAN_DIR, { recursive: true });

  const manifest = {
    teacher1: { email: ACCOUNTS.teacher1.email, userId: ACCOUNTS.teacher1.id },
    student: { email: ACCOUNTS.student.email, userId: ACCOUNTS.student.id },
    teacher2: { email: ACCOUNTS.teacher2.email, userId: ACCOUNTS.teacher2.id },
    fixtures: {
      stageId: FIXTURES.stageId,
      chapterId: FIXTURES.chapterId,
      lessonId1: FIXTURES.lessonId1,
      lessonId2: FIXTURES.lessonId2,
      otherTeacherChapterId: FIXTURES.otherTeacherChapterId,
      otherTeacherLessonId: FIXTURES.otherTeacherLessonId,
      unindexedChapterId: FIXTURES.unindexedChapterId,
    },
    ragReady,
    seedVersion: SEED_VERSION,
  };
  writeFileSync(
    join(POSTMAN_DIR, "story45-seed-manifest.local.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const v = (
    key: string,
    value: string,
    type: "default" | "secret" = "default",
  ) => ({
    key,
    value,
    enabled: true,
    type,
  });
  const env = {
    id: "fahimni-local-populated",
    name: "Fahimni Local (populated)",
    values: [
      v("baseUrl", "http://localhost:3000"),
      v("teacherEmail", ACCOUNTS.teacher1.email),
      v("teacherPassword", localPassword, "secret"),
      v("teacherUserId", ACCOUNTS.teacher1.id),
      v("studentEmail", ACCOUNTS.student.email),
      v("studentPassword", localPassword, "secret"),
      v("studentUserId", ACCOUNTS.student.id),
      v("otherTeacherEmail", ACCOUNTS.teacher2.email),
      v("otherTeacherPassword", localPassword, "secret"),
      v("otherTeacherUserId", ACCOUNTS.teacher2.id),
      v("stageId", FIXTURES.stageId),
      v("chapterId", FIXTURES.chapterId),
      v("lessonId1", FIXTURES.lessonId1),
      v("lessonId2", FIXTURES.lessonId2),
      v("otherTeacherChapterId", FIXTURES.otherTeacherChapterId),
      v("otherTeacherLessonId", FIXTURES.otherTeacherLessonId),
      v("unindexedChapterId", FIXTURES.unindexedChapterId),
      v("missingUuid", FIXTURES.missingUuid),
      v("expectedQuestionCount", String(FIXTURES.expectedQuestionCount)),
      v("indexPollAttempts", "0"),
      v("maxIndexPollAttempts", "20"),
      v("indexSampleText", "المعادلة الخطية من الدرجة الأولى."),
      // Runtime values — intentionally empty.
      v("teacherToken", ""),
      v("studentToken", ""),
      v("otherTeacherToken", ""),
      v("createdQuizId", ""),
      v("createdQuizIdLessons", ""),
    ],
    _postman_variable_scope: "environment",
  };
  writeFileSync(
    join(POSTMAN_DIR, "Fahimni_Local.postman_environment.json"),
    JSON.stringify(env, null, 2) + "\n",
  );
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  const host = assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    productionFlag: process.env.PRODUCTION,
  });
  console.log(
    `[seed] Local database verified (host: ${host}). Version: ${SEED_VERSION}`,
  );

  if (!LOCAL_PASSWORD) {
    throw new Error(
      "SEED_LOCAL_PASSWORD is not set. Add it to your git-ignored .env " +
        "(local-only). The seed never hardcodes the local password.",
    );
  }

  // Hash the local password exactly once.
  const passwordHash = await bcrypt.hash(LOCAL_PASSWORD, BCRYPT_ROUNDS);

  const removed = await cleanupLegacySeed();
  if (removed > 0) {
    console.log(
      `[seed] Removed ${removed} legacy seed user(s) and their content.`,
    );
  }

  await upsertAccounts(passwordHash);
  console.log(
    "[seed] Accounts upserted: teacher1, teacher2, student (+ admin).",
  );

  const relStart = Date.now();
  const counts = await seedRelational();
  const relMs = Date.now() - relStart;
  console.log(
    `[seed] Stages +${counts.stages.inserted}/${skipped(counts.stages)} skipped | ` +
      `Chapters +${counts.chapters.inserted}/${skipped(counts.chapters)} skipped | ` +
      `Lessons +${counts.lessons.inserted}/${skipped(counts.lessons)} skipped`,
  );

  // ── Optional AI-ready indexing ──────────────────────────────────────────
  let ragReady = false;
  let aiMs = 0;
  const existingChunks = await chunkCount(FIXTURES.indexLessonIds);

  if (process.env.SEED_AI_READY === "true") {
    const aiStart = Date.now();
    const r = await indexSuccessfulLessons();
    aiMs = Date.now() - aiStart;
    ragReady = (await chunkCount(FIXTURES.indexLessonIds)) > 0;
    console.log(
      `[seed] AI indexing: ${r.indexed} indexed, ${r.skipped} already-ready. ragReady=${ragReady} (${aiMs}ms)`,
    );
  } else {
    ragReady = existingChunks > 0;
    if (ragReady) {
      console.log(
        `[seed] AI-ready: successful lessons already have ${existingChunks} chunk(s) → ragReady=true.`,
      );
    } else {
      console.log(
        "[seed] AI-ready: NOT indexed. Run with SEED_AI_READY=true (needs GEMINI_API_KEY)\n" +
          "        or index via POST /api/ai/index/:lessonId before live STORY-45 generation.",
      );
    }
  }

  writeArtifacts(ragReady, LOCAL_PASSWORD);
  console.log(
    "[seed] Wrote postman/story45-seed-manifest.local.json and Fahimni_Local.postman_environment.json (git-ignored).",
  );

  console.log(
    `[seed] Done in ${Date.now() - startedAt}ms (relational ${relMs}ms${aiMs ? `, ai ${aiMs}ms` : ""}).`,
  );
}

main()
  .catch((error) => {
    console.error(
      "[seed] FAILED:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
