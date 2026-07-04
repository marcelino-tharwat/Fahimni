/**
 * Upload small test PDFs to local/dev Supabase and create valid chemistry material rows.
 * Requires SEED_REAL_PDF_MATERIALS=true and local database.
 */
import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import { seedId } from "../src/seed/chemistry-ids.js";
import {
  ALL_CHEMISTRY_MATERIAL_IDS,
  buildChemistryLessonMaterials,
  CHEMISTRY_CH1_L1_MATERIAL_A,
  ensureChemistryPdfFixturesInStorage,
} from "../src/seed/chemistry-material-seed.js";
import { chemistryLessonId } from "../src/seed/chemistry-lesson-catalog.js";

const TEACHER_ID = seedId("teacher");
const STUDENT01_ID = seedId("student-01");

async function main(): Promise<void> {
  if (process.env.SEED_REAL_PDF_MATERIALS !== "true") {
    throw new Error("Set SEED_REAL_PDF_MATERIALS=true to run fixture setup");
  }
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  const lessonId = chemistryLessonId(0, 0);
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    throw new Error(`Lesson ${lessonId} not found — run db:seed first`);
  }

  await ensureChemistryPdfFixturesInStorage(TEACHER_ID);
  const materials = buildChemistryLessonMaterials(TEACHER_ID);

  // Remove any existing seed material rows (scoped) before recreate
  await prisma.lessonMaterialDownload.deleteMany({
    where: { materialId: { in: [...ALL_CHEMISTRY_MATERIAL_IDS] } },
  });
  await prisma.lessonMaterial.deleteMany({
    where: { id: { in: [...ALL_CHEMISTRY_MATERIAL_IDS] } },
  });

  await prisma.lessonMaterial.createMany({ data: materials });

  const materialDownloadedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.lessonMaterialDownload.create({
    data: {
      id: seedId("material-download-student01-a"),
      studentId: STUDENT01_ID,
      materialId: CHEMISTRY_CH1_L1_MATERIAL_A,
      firstDownloadedAt: materialDownloadedAt,
      lastDownloadedAt: materialDownloadedAt,
    },
  });

  const rows = await prisma.lessonMaterial.findMany({
    where: { lessonId },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, fileSize: true },
  });
  const downloads = await prisma.lessonMaterialDownload.findMany({
    where: { materialId: { in: [...ALL_CHEMISTRY_MATERIAL_IDS] } },
    select: { materialId: true, studentId: true },
  });

  console.log("Fixture materials on lesson:", rows.length);
  for (const r of rows) {
    console.log(" -", r.id, r.displayName);
  }
  console.log("Download rows:", downloads.length);
  for (const d of downloads) {
    console.log(" - student", d.studentId, "material", d.materialId);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
