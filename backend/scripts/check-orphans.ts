import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const materials = await prisma.lessonMaterial.findMany({
  select: { id: true, lessonId: true, displayName: true },
});
console.log("All lesson_materials:", JSON.stringify(materials, null, 2));

const orphaned: typeof materials = [];
for (const m of materials) {
  const lesson = await prisma.lesson.findUnique({ where: { id: m.lessonId }, select: { id: true } });
  if (!lesson) {
    orphaned.push(m);
  }
}
console.log("Orphaned records:", JSON.stringify(orphaned, null, 2));

if (orphaned.length > 0) {
  const ids = orphaned.map((o) => o.id);
  console.log(`Deleting ${ids.length} orphaned records...`);
  await prisma.lessonMaterial.deleteMany({ where: { id: { in: ids } } });
  console.log("Deleted successfully.");
}

await prisma.$disconnect();
