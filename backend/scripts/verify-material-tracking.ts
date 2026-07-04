/**
 * Backend verification for PDF download tracking (local dev fixtures).
 */
import "dotenv/config";
import { prisma } from "../src/config/database.js";
import {
  CHEMISTRY_CH1_L1_MATERIAL_A,
  CHEMISTRY_CH1_L1_MATERIAL_B,
  CHEMISTRY_CH1_L1_MATERIAL_C,
} from "../src/seed/chemistry-material-seed.js";
import { chemistryLessonId } from "../src/seed/chemistry-lesson-catalog.js";
import { seedId } from "../src/seed/chemistry-ids.js";

const BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const PW = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

const STUDENT01 = "chem.student01@fahimni.test";
const STUDENT04 = "chem.student04@fahimni.test";
const TEACHER = "teacher.chemistry@fahimni.test";
const ADMIN = "admin.chemistry@fahimni.test";
const LESSON_ID = chemistryLessonId(0, 0);
const STUDENT01_ID = seedId("student-01");
const STUDENT04_ID = seedId("student-04");

function parseCookies(setCookie: string[] | string | undefined): Record<string, string> {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const out: Record<string, string> = {};
  for (const h of headers) {
    const part = h.split(";")[0]!;
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const cookies = parseCookies(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie") ?? undefined);
  const access = cookies.access_token;
  if (!access) throw new Error(`No access_token for ${email}`);
  return access;
}

async function countDownloads(materialId: string, studentId: string): Promise<number> {
  return prisma.lessonMaterialDownload.count({
    where: { materialId, studentId },
  });
}

async function getDownloadRow(materialId: string, studentId: string) {
  return prisma.lessonMaterialDownload.findUnique({
    where: { studentId_materialId: { studentId, materialId } },
  });
}

async function studentLessonMaterials(token: string) {
  const res = await fetch(`${BASE}/api/content/student/lessons/${LESSON_ID}`, {
    headers: { Cookie: `access_token=${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function preview(token: string, materialId: string) {
  const res = await fetch(`${BASE}/api/lesson-materials/${materialId}/preview`, {
    headers: { Cookie: `access_token=${token}` },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    bytes: buf.length,
    isPdf: buf.subarray(0, 5).toString() === "%PDF-",
  };
}

async function download(token: string, materialId: string) {
  const res = await fetch(`${BASE}/api/lesson-materials/${materialId}/download`, {
    headers: { Cookie: `access_token=${token}` },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    disposition: res.headers.get("content-disposition"),
    bytes: buf.length,
    isPdf: buf.subarray(0, 5).toString() === "%PDF-",
  };
}

async function teacherStatus(token: string, materialId: string) {
  const res = await fetch(`${BASE}/api/lesson-materials/${materialId}/download-statuses`, {
    headers: { Cookie: `access_token=${token}` },
  });
  return { status: res.status, body: await res.json() };
}

async function main(): Promise<void> {
  const s1 = await login(STUDENT01);
  const s4 = await login(STUDENT04);
  const teacher = await login(TEACHER);
  const admin = await login(ADMIN);

  const beforeB = await countDownloads(CHEMISTRY_CH1_L1_MATERIAL_B, STUDENT01_ID);
  const previewB = await preview(s1, CHEMISTRY_CH1_L1_MATERIAL_B);
  const afterPreviewB = await countDownloads(CHEMISTRY_CH1_L1_MATERIAL_B, STUDENT01_ID);

  const beforeC = await countDownloads(CHEMISTRY_CH1_L1_MATERIAL_C, STUDENT01_ID);
  const downloadC1 = await download(s1, CHEMISTRY_CH1_L1_MATERIAL_C);
  await new Promise((r) => setTimeout(r, 300));
  const afterDownloadC1 = await getDownloadRow(CHEMISTRY_CH1_L1_MATERIAL_C, STUDENT01_ID);
  const firstAt = afterDownloadC1?.firstDownloadedAt?.toISOString() ?? null;
  await new Promise((r) => setTimeout(r, 500));
  const downloadC2 = await download(s1, CHEMISTRY_CH1_L1_MATERIAL_C);
  await new Promise((r) => setTimeout(r, 300));
  const afterDownloadC2 = await getDownloadRow(CHEMISTRY_CH1_L1_MATERIAL_C, STUDENT01_ID);
  const rowCountC = await countDownloads(CHEMISTRY_CH1_L1_MATERIAL_C, STUDENT01_ID);

  const lockedPreview = await preview(s4, CHEMISTRY_CH1_L1_MATERIAL_B);
  const lockedDownload = await download(s4, CHEMISTRY_CH1_L1_MATERIAL_C);
  const lockedTrackCount = await countDownloads(CHEMISTRY_CH1_L1_MATERIAL_C, STUDENT04_ID);

  const lessonMaterials = await studentLessonMaterials(s1);
  const statusA = await teacherStatus(teacher, CHEMISTRY_CH1_L1_MATERIAL_A);
  const statusB = await teacherStatus(teacher, CHEMISTRY_CH1_L1_MATERIAL_B);
  const statusC = await teacherStatus(teacher, CHEMISTRY_CH1_L1_MATERIAL_C);
  const statusDenied = await teacherStatus(admin, CHEMISTRY_CH1_L1_MATERIAL_A);

  console.log(JSON.stringify({
    previewB,
    beforeB,
    afterPreviewB,
    downloadC1,
    beforeC,
    afterDownloadC1: {
      rowCountC,
      firstDownloadedAt: firstAt,
      lastDownloadedAt: afterDownloadC1?.lastDownloadedAt?.toISOString() ?? null,
    },
    downloadC2,
    afterDownloadC2: {
      rowCountC,
      firstDownloadedAt: afterDownloadC2?.firstDownloadedAt?.toISOString() ?? null,
      lastDownloadedAt: afterDownloadC2?.lastDownloadedAt?.toISOString() ?? null,
      firstPreserved: afterDownloadC2?.firstDownloadedAt?.toISOString() === firstAt,
    },
    lockedPreview,
    lockedDownload,
    lockedTrackCount,
    lessonMaterials: {
      status: lessonMaterials.status,
      materials: lessonMaterials.body?.data?.materials?.map((m: { id: string; hasDownloaded: boolean }) => ({
        id: m.id,
        hasDownloaded: m.hasDownloaded,
      })),
    },
    teacherStatusA: summarizeTeacher(statusA),
    teacherStatusB: summarizeTeacher(statusB),
    teacherStatusC: summarizeTeacher(statusC),
    teacherStatusDenied: { status: statusDenied.status, code: statusDenied.body?.error?.code },
  }, null, 2));
}

function summarizeTeacher(r: { status: number; body: unknown }) {
  const b = r.body as {
    summary?: { enrolledStudentCount: number; downloadedCount: number; notDownloadedCount: number };
    students?: Array<{ studentName: string; hasDownloaded: boolean }>;
  };
  const s01 = b.students?.find((s) => s.studentName.includes("01") || s.studentName.includes("1"));
  return {
    status: r.status,
    summary: b.summary,
    student01: s01,
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
