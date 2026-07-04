/**
 * Browser-style verification via frontend API client flow (cookie auth + blob download).
 * Run while backend (3000) and frontend (5173) are up.
 */
import "dotenv/config";
import {
  CHEMISTRY_CH1_L1_MATERIAL_A,
  CHEMISTRY_CH1_L1_MATERIAL_B,
  CHEMISTRY_CH1_L1_MATERIAL_C,
} from "../src/seed/chemistry-material-seed.js";
import { chemistryLessonId } from "../src/seed/chemistry-lesson-catalog.js";
import { prisma } from "../src/config/database.js";

const API = process.env.API_BASE_URL ?? "http://127.0.0.1:3000/api";
const PW = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";
const LESSON_ID = chemistryLessonId(0, 0);

function cookiesFromResponse(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  const parts = raw.map((h) => h.split(";")[0]).filter(Boolean);
  return parts.join("; ");
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${API.replace(/\/api$/, "")}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  if (!res.ok) throw new Error(`login ${email} => ${res.status}`);
  return cookiesFromResponse(res);
}

async function getLesson(cookie: string) {
  const res = await fetch(`${API}/content/student/lessons/${LESSON_ID}`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json();
  return { status: res.status, materials: body?.data?.attachments ?? [] };
}

async function preview(cookie: string, id: string) {
  const res = await fetch(`${API}/lesson-materials/${id}/preview`, { headers: { Cookie: cookie } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: buf.length, isPdf: buf.subarray(0, 5).toString() === "%PDF-" };
}

async function download(cookie: string, id: string) {
  const res = await fetch(`${API}/lesson-materials/${id}/download`, { headers: { Cookie: cookie } });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    bytes: buf.length,
    isPdf: buf.subarray(0, 5).toString() === "%PDF-",
    disposition: res.headers.get("content-disposition"),
  };
}

async function main() {
  const cookie = await login("chem.student01@fahimni.test");
  const initial = await getLesson(cookie);

  const matA = initial.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_A);
  const matB = initial.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_B);
  const matC = initial.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_C);

  const previewB = await preview(cookie, CHEMISTRY_CH1_L1_MATERIAL_B);
  const afterPreview = await getLesson(cookie);
  const matBAfterPreview = afterPreview.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_B);

  const downloadC = await download(cookie, CHEMISTRY_CH1_L1_MATERIAL_C);
  await new Promise((r) => setTimeout(r, 400));
  const afterDownload = await getLesson(cookie);
  const matCAfter = afterDownload.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_C);
  const matAAfter = afterDownload.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_A);

  // unauthenticated denial
  const unauth = await fetch(`${API}/lesson-materials/${CHEMISTRY_CH1_L1_MATERIAL_C}/download`);

  console.log(JSON.stringify({
    lessonId: LESSON_ID,
    materialCount: initial.materials.length,
    filenames: initial.materials.map((m: { displayName: string }) => m.displayName),
    initialHasDownloaded: {
      A: matA?.hasDownloaded,
      B: matB?.hasDownloaded,
      C: matC?.hasDownloaded,
    },
    previewB,
    matBAfterPreviewHasDownloaded: matBAfterPreview?.hasDownloaded,
    downloadC,
    afterDownloadHasDownloaded: {
      A: matAAfter?.hasDownloaded,
      B: afterDownload.materials.find((m: { id: string }) => m.id === CHEMISTRY_CH1_L1_MATERIAL_B)?.hasDownloaded,
      C: matCAfter?.hasDownloaded,
    },
    unauthDownloadStatus: unauth.status,
    noFilePathLeak: initial.materials.every((m: Record<string, unknown>) => !("filePath" in m) && !("url" in m)),
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
