/**
 * One-time migration: convert legacy Lesson.pdfUrls entries into
 * LessonMaterial records with real metadata (fileSize, mimeType).
 *
 * Background:
 *   The old lesson create/update API accepted `pdfUrls: string[]` — raw
 *   Supabase storage keys stored in a JSONB column on the Lesson model.
 *   The new approach uses a separate LessonMaterial table populated by
 *   the file upload endpoint, with proper displayName, fileSize, and
 *   mimeType.
 *
 *   This script finds every Lesson where pdfUrls is non-empty, checks
 *   whether each key already has a LessonMaterial record, and if not,
 *   fetches the real file metadata via a Supabase signed-URL + HEAD
 *   request before creating the record.
 *
 * Safe to re-run (idempotent — checks filePath uniqueness per lesson).
 */

import { prisma } from "../src/config/database.js";
import { supabase } from "../src/config/supabase.js";

const BUCKET = process.env.SUPABASE_BUCKET_NAME ?? "lesson-materials";

interface FileMeta {
  exists: boolean;
  fileSize: number;
  mimeType: string;
}

async function fetchFileMeta(filePath: string): Promise<FileMeta> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      return { exists: false, fileSize: 0, mimeType: "" };
    }

    const response = await fetch(data.signedUrl, { method: "HEAD" });

    if (!response.ok) {
      return { exists: false, fileSize: 0, mimeType: "" };
    }

    return {
      exists: true,
      fileSize: Number(response.headers.get("content-length") ?? 0),
      mimeType:
        response.headers.get("content-type") ?? "application/pdf",
    };
  } catch {
    return { exists: false, fileSize: 0, mimeType: "" };
  }
}

function deriveDisplayName(filePath: string): string {
  const segments = filePath.split("/");
  return segments[segments.length - 1] ?? filePath;
}

async function main() {
  console.log("=== Legacy pdfUrls Migration ===\n");

  // ── Step 1: Find all lessons with non-empty pdfUrls ──────────────
  const lessons = await prisma.lesson.findMany({
    where: {
      pdfUrls: { not: null },
      NOT: { pdfUrls: { equals: [] } },
    },
    select: { id: true, pdfUrls: true, title: true },
  });

  console.log(`Lessons with pdfUrls: ${lessons.length}\n`);

  if (lessons.length === 0) {
    console.log("Nothing to migrate. Exiting.");
    return;
  }

  // ── Step 2: For each lesson, find unmatched keys ────────────────
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalLessonsProcessed = 0;

  for (const lesson of lessons) {
    const pdfUrls = (lesson.pdfUrls as string[]) ?? [];
    if (pdfUrls.length === 0) continue;

    // Fetch existing LessonMaterial filePaths for this lesson (including soft-deleted,
    // since a deleted material and a new upload could share the same key in theory).
    const existing = await prisma.lessonMaterial.findMany({
      where: { lessonId: lesson.id },
      select: { filePath: true },
      // Include soft-deleted so we don't re-create records for keys that were
      // once uploaded and then removed.
    });
    const existingPaths = new Set(existing.map((m) => m.filePath));

    const unmatched = pdfUrls.filter((key) => !existingPaths.has(key));
    if (unmatched.length === 0) continue;

    totalLessonsProcessed++;

    for (const key of unmatched) {
      const meta = await fetchFileMeta(key);

      if (!meta.exists) {
        console.warn(
          `  [SKIP]  ${lesson.id} — key not found in storage: ${key}`,
        );
        totalSkipped++;
        continue;
      }

      await prisma.lessonMaterial.create({
        data: {
          lessonId: lesson.id,
          filePath: key,
          displayName: deriveDisplayName(key),
          fileSize: meta.fileSize,
          mimeType: meta.mimeType,
        },
      });

      console.log(
        `  [OK]    ${lesson.id} → ${key} (${meta.fileSize} bytes, ${meta.mimeType})`,
      );
      totalCreated++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n=== Summary ===");
  console.log(`  Lessons processed:        ${totalLessonsProcessed}`);
  console.log(`  LessonMaterial created:   ${totalCreated}`);
  console.log(`  Keys skipped (not found): ${totalSkipped}`);

  const totalAfter = await prisma.lessonMaterial.count({
    where: { deletedAt: null },
  });
  console.log(`  Total LessonMaterial now: ${totalAfter}`);
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
