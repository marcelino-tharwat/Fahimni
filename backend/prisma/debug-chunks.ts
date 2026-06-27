import "dotenv/config";
import { prisma } from "../src/config/database.js";

const r1 = await prisma.$queryRaw<Array<{ n: number }>>`SELECT COUNT(*)::int as n FROM content_chunks`;
console.log("Total chunks:", r1[0]?.n);

const r2 = await prisma.$queryRaw<Array<{ lessonId: string; n: number }>>`
  SELECT "lessonId", COUNT(*)::int as n FROM content_chunks GROUP BY "lessonId" ORDER BY "lessonId" LIMIT 5
`;
console.log("Sample chunks by lesson:");
for (const x of r2) console.log(" ", x.lessonId, "->", x.n, "chunks");

const r3 = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(DISTINCT "lessonId")::int as n FROM content_chunks
`;
console.log("Distinct lessons with chunks:", r3[0]?.n);

const r4 = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int as n FROM content_chunks WHERE embedding IS NULL
`;
console.log("Chunks with NULL embedding:", r4[0]?.n);

const r5 = await prisma.$queryRaw<Array<{ id: string }>>`
  SELECT id FROM content_chunks LIMIT 3
`;
console.log("Sample chunk IDs:");
for (const x of r5) console.log(" ", x.id);

// Check using Prisma ORM instead of raw SQL for Lesson table
const linearChapterId = "f4500100-0001-4001-8001-000000000001";
const lessonsInChapter = await prisma.lesson.findMany({
  where: { chapterId: linearChapterId, deletedAt: null },
  select: { id: true, title: true },
  orderBy: { sortOrder: "asc" },
});
console.log("\nLessons in linear functions chapter:");
for (const x of lessonsInChapter) console.log(" ", x.id, "-", x.title);

// Check chunk count for these specific lessons
const lessonIds = lessonsInChapter.map((l) => l.id);
if (lessonIds.length > 0) {
  const chunkCountInChapter = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int as n FROM content_chunks WHERE "lessonId" = ANY(${lessonIds}::text[])
  `;
  console.log("Chunks for linear functions lessons:", chunkCountInChapter[0]?.n);
}

await prisma.$disconnect();
