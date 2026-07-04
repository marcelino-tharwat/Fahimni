/**
 * Scoped cleanup of deterministic fake placeholder chemistry seed materials.
 * Local/dev only — deletes only ALL_CHEMISTRY_MATERIAL_IDS and linked downloads.
 */
import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import { ALL_CHEMISTRY_MATERIAL_IDS } from "../src/seed/chemistry-material-seed.js";

async function main(): Promise<void> {
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  const fakeMaterialIds = [...ALL_CHEMISTRY_MATERIAL_IDS];

  const beforeMaterials = await prisma.lessonMaterial.findMany({
    where: { id: { in: fakeMaterialIds } },
    select: { id: true, displayName: true, filePath: true, lessonId: true },
  });
  const beforeDownloads = await prisma.lessonMaterialDownload.findMany({
    where: { materialId: { in: fakeMaterialIds } },
    select: { id: true, studentId: true, materialId: true },
  });
  const otherCount = await prisma.lessonMaterial.count({
    where: { id: { notIn: fakeMaterialIds } },
  });

  console.log("Before cleanup — fake materials:", beforeMaterials.length);
  console.log("Before cleanup — fake downloads:", beforeDownloads.length);
  console.log("Non-seed materials preserved count:", otherCount);

  const deletedDownloads = await prisma.lessonMaterialDownload.deleteMany({
    where: { materialId: { in: fakeMaterialIds } },
  });
  const deletedMaterials = await prisma.lessonMaterial.deleteMany({
    where: { id: { in: fakeMaterialIds } },
  });

  const afterMaterials = await prisma.lessonMaterial.count({
    where: { id: { in: fakeMaterialIds } },
  });
  const afterDownloads = await prisma.lessonMaterialDownload.count({
    where: { materialId: { in: fakeMaterialIds } },
  });
  const otherAfter = await prisma.lessonMaterial.count({
    where: { id: { notIn: fakeMaterialIds } },
  });

  console.log("Deleted downloads:", deletedDownloads.count);
  console.log("Deleted materials:", deletedMaterials.count);
  console.log("After cleanup — fake materials:", afterMaterials);
  console.log("After cleanup — fake downloads:", afterDownloads);
  console.log("Non-seed materials after:", otherAfter);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
