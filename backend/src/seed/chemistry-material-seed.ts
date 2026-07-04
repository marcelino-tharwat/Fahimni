/**
 * Deterministic lesson material fixtures for chemistry dev seed (chapter 1 lesson 1).
 * Default seed does NOT create materials. Set SEED_REAL_PDF_MATERIALS=true to upload
 * small test PDFs to local/dev Supabase and seed valid rows.
 */
import { supabase } from "../config/supabase.js";
import { seedId } from "./chemistry-ids.js";
import { chemistryLessonId } from "./chemistry-lesson-catalog.js";

export const CHEMISTRY_CH1_L1_MATERIAL_A = seedId("material-ch1-l1-a");
export const CHEMISTRY_CH1_L1_MATERIAL_B = seedId("material-ch1-l1-b");
export const CHEMISTRY_CH1_L1_MATERIAL_C = seedId("material-ch1-l1-c");

export const ALL_CHEMISTRY_MATERIAL_IDS = [
  CHEMISTRY_CH1_L1_MATERIAL_A,
  CHEMISTRY_CH1_L1_MATERIAL_B,
  CHEMISTRY_CH1_L1_MATERIAL_C,
] as const;

export const SEED_REAL_PDF_MATERIALS_ENABLED =
  process.env.SEED_REAL_PDF_MATERIALS === "true";

const FIXTURE_FILE_NAMES = {
  a: "fixture-material-a.pdf",
  b: "fixture-material-b.pdf",
  c: "fixture-material-c.pdf",
} as const;

function minimalPdf(label: string): Buffer {
  const text = `%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 20 100 Td (${label}) Tj ET\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n430\n%%EOF`;
  return Buffer.from(text, "utf8");
}

export function buildChemistryLessonMaterialBasePath(teacherId: string): string {
  const lessonId = chemistryLessonId(0, 0);
  return `teachers/${teacherId}/lessons/${lessonId}`;
}

export function buildChemistryLessonMaterials(
  teacherId: string,
): Array<{
  id: string;
  lessonId: string;
  filePath: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
}> {
  const lessonId = chemistryLessonId(0, 0);
  const base = buildChemistryLessonMaterialBasePath(teacherId);

  return [
    {
      id: CHEMISTRY_CH1_L1_MATERIAL_A,
      lessonId,
      filePath: `${base}/${FIXTURE_FILE_NAMES.a}`,
      displayName: "ملخص الدرس - خواص العناصر.pdf",
      fileSize: minimalPdf("MatA").length,
      mimeType: "application/pdf",
    },
    {
      id: CHEMISTRY_CH1_L1_MATERIAL_B,
      lessonId,
      filePath: `${base}/${FIXTURE_FILE_NAMES.b}`,
      displayName: "أوراق عمل - العناصر الانتقالية.pdf",
      fileSize: minimalPdf("MatB").length,
      mimeType: "application/pdf",
    },
    {
      id: CHEMISTRY_CH1_L1_MATERIAL_C,
      lessonId,
      filePath: `${base}/${FIXTURE_FILE_NAMES.c}`,
      displayName: "مراجع إضافية - الفصل الأول.pdf",
      fileSize: minimalPdf("MatC").length,
      mimeType: "application/pdf",
    },
  ];
}

async function verifyStoragePdf(filePath: string): Promise<boolean> {
  const bucket = process.env.SUPABASE_BUCKET_NAME!;
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !data) return false;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.length > 0 && buf.subarray(0, 5).toString() === "%PDF-";
}

export async function ensureChemistryPdfFixturesInStorage(
  teacherId: string,
): Promise<void> {
  const bucket = process.env.SUPABASE_BUCKET_NAME!;
  const materials = buildChemistryLessonMaterials(teacherId);

  for (const m of materials) {
    const label =
      m.id === CHEMISTRY_CH1_L1_MATERIAL_A
        ? "MatA"
        : m.id === CHEMISTRY_CH1_L1_MATERIAL_B
          ? "MatB"
          : "MatC";

    const exists = await verifyStoragePdf(m.filePath);
    if (exists) continue;

    const buffer = minimalPdf(label);
    const { error } = await supabase.storage.from(bucket).upload(m.filePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) {
      throw new Error(
        `Failed to upload chemistry PDF fixture (${m.displayName}): ${error.message}`,
      );
    }

    const verified = await verifyStoragePdf(m.filePath);
    if (!verified) {
      throw new Error(
        `Uploaded chemistry PDF fixture failed verification (${m.displayName})`,
      );
    }
  }
}

export async function assertChemistryPdfFixturesInStorage(
  teacherId: string,
): Promise<void> {
  const materials = buildChemistryLessonMaterials(teacherId);
  for (const m of materials) {
    const ok = await verifyStoragePdf(m.filePath);
    if (!ok) {
      throw new Error(
        `Missing chemistry PDF fixture in storage for ${m.displayName}. Run with SEED_REAL_PDF_MATERIALS=true or scripts/setup-real-pdf-fixtures.ts`,
      );
    }
  }
}
