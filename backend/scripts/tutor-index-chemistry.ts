/**
 * Idempotent Chemistry demo RAG indexing (local development only).
 * Does not run in production; never prints lesson/chunk text.
 */
import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { aiService } from "../src/modules/ai/ai.service.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  CHEMISTRY_RAG_CONTENT,
  CHEMISTRY_RAG_VERSION,
  CHEMISTRY_TEACHER_EMAIL,
} from "../src/seed/chemistry-rag-content.js";
import { seedId } from "../src/seed/chemistry-ids.js";

async function isAlreadyIndexed(lessonId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<
    Array<{ metadata: { chemistryRagVersion?: string } | null }>
  >`
    SELECT metadata FROM content_chunks
    WHERE "lessonId" = ${lessonId}
    LIMIT 1
  `;
  return rows[0]?.metadata?.chemistryRagVersion === CHEMISTRY_RAG_VERSION;
}

async function main(): Promise<void> {
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    productionFlag: process.env.FAHIMNI_PRODUCTION,
  });

  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error("tutor:index:chemistry is not allowed in production");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for Chemistry indexing");
  }

  const teacher = await prisma.user.findUnique({
    where: { email: CHEMISTRY_TEACHER_EMAIL },
    select: { id: true },
  });
  if (!teacher) {
    throw new Error("Chemistry teacher not found — run db:seed first");
  }

  const stage = await prisma.stage.findFirst({
    where: { teacherId: teacher.id, deletedAt: null },
    select: { id: true },
  });
  if (!stage) {
    throw new Error("Chemistry stage not found — run db:seed first");
  }

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const [lessonId, content] of Object.entries(CHEMISTRY_RAG_CONTENT)) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, chapter: { select: { stageId: true } } },
    });

    if (!lesson || lesson.chapter.stageId !== stage.id) {
      missing++;
      continue;
    }

    if (await isAlreadyIndexed(lessonId)) {
      skipped++;
      continue;
    }

    await aiService.indexLesson(lessonId, content, {
      chemistryRagVersion: CHEMISTRY_RAG_VERSION,
      source: "chemistry-index",
      demo: true,
    });
    created++;
  }

  const chunkRows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM content_chunks cc
    INNER JOIN lessons l ON l.id = cc."lessonId"
    INNER JOIN chapters c ON c.id = l."chapterId"
    WHERE c."stageId" = ${stage.id}
  `;
  const chemistryChunks = Number(chunkRows[0]?.n ?? 0);

  logger.info("chemistry_indexing_completed", {
    stageId: stage.id,
    teacherId: teacher.id,
    lessonsInMap: Object.keys(CHEMISTRY_RAG_CONTENT).length,
    created,
    skipped,
    missing,
    chemistryChunks,
    version: CHEMISTRY_RAG_VERSION,
  });

  console.log(
    JSON.stringify({
      event: "chemistry_indexing_completed",
      created,
      skipped,
      missing,
      chemistryChunks,
      chemistryStageId: stage.id,
      chemistryTeacherId: teacher.id,
      demoStudentId: seedId("student-01"),
    }),
  );
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "chemistry_indexing_failed", message }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
