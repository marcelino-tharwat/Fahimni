import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";

/**
 * Populates the local Postman environment for the Quiz Generation & Submission
 * E2E from the latest seed manifest, after verifying the seeded fixtures in the
 * local database. Local-only; never prints passwords / API keys / DB URL.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTMAN_DIR = join(__dirname, "..", "postman");
const MANIFEST = join(POSTMAN_DIR, "story45-seed-manifest.local.json");
const OUT = join(
  POSTMAN_DIR,
  "Fahimni_Quiz_Generation_Submission.local.postman_environment.json",
);

const BASE_URL = process.env.POSTMAN_BASE_URL ?? "http://localhost:3000";
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD;

interface Manifest {
  teacher1: { email: string; userId: string };
  student: { email: string; userId: string };
  teacher2: { email: string; userId: string };
  fixtures: {
    stageId: string;
    chapterId: string;
    lessonId1: string;
    lessonId2: string;
    otherTeacherChapterId: string;
    otherTeacherLessonId: string;
    unindexedChapterId: string;
  };
}

async function chunkCount(lessonId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int n FROM content_chunks WHERE "lessonId" = ${lessonId}`;
  return rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    productionFlag: process.env.PRODUCTION,
  });

  if (!LOCAL_PASSWORD) {
    throw new Error(
      "SEED_LOCAL_PASSWORD is not set (local .env). Run the seed first.",
    );
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  const f = manifest.fixtures;

  // ── Verify accounts / roles / status ──────────────────────────────────
  const [t1, st, t2] = await Promise.all([
    prisma.user.findUnique({ where: { id: manifest.teacher1.userId }, select: { role: true, status: true } }),
    prisma.user.findUnique({ where: { id: manifest.student.userId }, select: { role: true, status: true } }),
    prisma.user.findUnique({ where: { id: manifest.teacher2.userId }, select: { role: true, status: true } }),
  ]);
  if (t1?.role !== "OPERATION" || t1.status !== "ACTIVE") throw new Error("teacher1 is not an active OPERATION user");
  if (st?.role !== "STUDENT" || st.status !== "ACTIVE") throw new Error("student is not an active STUDENT user");
  if (t2?.role !== "OPERATION" || t2.status !== "ACTIVE") throw new Error("teacher2 is not an active OPERATION user");

  // ── Verify chapter ownership (Chapter -> Stage -> teacherId) ──────────
  const chapter = await prisma.chapter.findFirst({
    where: { id: f.chapterId, deletedAt: null, stage: { teacherId: manifest.teacher1.userId, deletedAt: null } },
    select: { id: true },
  });
  if (!chapter) throw new Error("chapter is not owned by teacher1 or is inactive");

  // ── Verify both lessons belong to the chapter and are active ──────────
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: [f.lessonId1, f.lessonId2] }, chapterId: f.chapterId, deletedAt: null },
    select: { id: true },
  });
  if (lessons.length !== 2) throw new Error("lessonId1/lessonId2 are not both active lessons of the chapter");

  // ── Verify active enrollment for the student ──────────────────────────
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_chapterId: { studentId: manifest.student.userId, chapterId: f.chapterId } },
    select: { status: true },
  });
  if (enrollment?.status !== "ACTIVE") throw new Error("student is not actively enrolled in the chapter");

  // ── Verify RAG readiness (usable chunks) ──────────────────────────────
  const [c1, c2] = await Promise.all([chunkCount(f.lessonId1), chunkCount(f.lessonId2)]);
  if (c1 === 0 || c2 === 0) {
    throw new Error(
      "Selected lessons are not indexed (no content chunks). Re-index before running the E2E.",
    );
  }

  // ── Write populated local environment ─────────────────────────────────
  const v = (key: string, value: string, type: "default" | "secret" = "default") => ({
    key, value, enabled: true, type,
  });
  const env = {
    id: "fahimni-quiz-gen-submission-local",
    name: "Fahimni Quiz Generation & Submission (local)",
    values: [
      v("baseUrl", BASE_URL),
      v("teacherEmail", manifest.teacher1.email),
      v("teacherPassword", LOCAL_PASSWORD, "secret"),
      v("teacherUserId", manifest.teacher1.userId),
      v("studentEmail", manifest.student.email),
      v("studentPassword", LOCAL_PASSWORD, "secret"),
      v("studentUserId", manifest.student.userId),
      v("otherTeacherEmail", manifest.teacher2.email),
      v("otherTeacherPassword", LOCAL_PASSWORD, "secret"),
      v("otherTeacherUserId", manifest.teacher2.userId),
      v("stageId", f.stageId),
      v("chapterId", f.chapterId),
      v("lessonId1", f.lessonId1),
      v("lessonId2", f.lessonId2),
      v("expectedChapterQuestionCount", "6"),
      v("expectedLessonQuestionCount", "4"),
      v("maxIndexPollAttempts", "20"),
      v("indexPollAttempts", "0"),
      // Runtime values — populated by the collection at run time.
      v("chapterGeneratedQuizId", ""),
      v("lessonGeneratedQuizId", ""),
      v("publishedQuizId", ""),
      v("attemptId", ""),
      v("submissionAnswers", ""),
      v("partialSubmissionAnswers", ""),
      v("pendingEssayQuestionIds", ""),
      v("essayGrades", ""),
    ],
    _postman_variable_scope: "environment",
  };

  mkdirSync(POSTMAN_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(env, null, 2) + "\n");

  console.log("[prepare] Verified fixtures and wrote populated local environment.");
  console.log(`[prepare] baseUrl=${BASE_URL}`);
  console.log(`[prepare] chapter chunks: lesson1=${c1}, lesson2=${c2} (ready)`);
  console.log("[prepare] File: postman/Fahimni_Quiz_Generation_Submission.local.postman_environment.json (git-ignored)");
}

main()
  .catch((e) => {
    console.error("[prepare] FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
