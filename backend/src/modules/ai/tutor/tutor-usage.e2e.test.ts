import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../../app.js";
import { prisma } from "../../../config/database.js";
import { geminiClient } from "../../../shared/services/geminiClient.js";

/**
 * STORY-65 — real HTTP/PostgreSQL E2E for the per-student daily AI-tutor cap.
 * Real auth/role/DTO/enrollment/quota-guard/usage-persistence/teacher-settings
 * against TEST_DATABASE_URL. Only the Gemini provider boundary is mocked.
 */

const DIM = 3072;
const PW = "E2ePass@123";
let pwHash: string;
let mobileSeq = 0;
let server: Server;
let base: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
  enrollmentIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
  setCookie: string[];
}

async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown } = {},
): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: HttpResult["json"] = null;
  try {
    json = (await res.json()) as HttpResult["json"];
  } catch {
    json = null;
  }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}

async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function createUser(role: "OPERATION" | "STUDENT"): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `tutor65-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({
    data: { id, email, fullName: `E2E ${role}`, mobile, password: pwHash, role, status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createTeacherProfile(userId: string): Promise<void> {
  await prisma.teacherProfile.create({ data: { userId } });
}
async function createStage(teacherId: string): Promise<string> {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: `stage-${id.slice(0, 8)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}
async function createChapter(stageId: string): Promise<string> {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name: `chapter-${id.slice(0, 8)}`, sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}
async function createLesson(chapterId: string): Promise<string> {
  const id = randomUUID();
  await prisma.lesson.create({ data: { id, title: "الدوال الخطية", durationMinutes: 10, sortOrder: 1, chapterId } });
  owned.lessonIds.push(id);
  return id;
}
async function enroll(studentId: string, chapterId: string): Promise<void> {
  const e = await prisma.enrollment.create({ data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status: "ACTIVE" } });
  owned.enrollmentIds.push(e.id);
}
async function insertChunk(lessonId: string): Promise<void> {
  const arr = new Array<number>(DIM).fill(0);
  arr[0] = 1;
  const vectorStr = `[${arr.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO content_chunks (id, content, embedding, "lessonId", metadata, "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${"الدالة الخطية علاقة من الدرجة الأولى."}, ${vectorStr}::vector, ${lessonId}, ${"{}"}::jsonb, NOW(), NOW())`;
}
async function setCap(teacherCookie: string, cap: number): Promise<HttpResult> {
  return http("PUT", "/api/teachers/profile", { cookie: teacherCookie, body: { aiTutorDailyQueryLimit: cap } });
}
async function usageToday(cookie: string): Promise<HttpResult> {
  return http("GET", "/api/tutor/usage-today", { cookie });
}
const Q = "اشرح لي مفهوم الدالة الخطية بالتفصيل من فضلك";

// Build an enrolled student under a fresh teacher with a given cap.
async function makeTeacherStudent(cap: number) {
  const teacher = await createUser("OPERATION");
  await createTeacherProfile(teacher.id);
  const stage = await createStage(teacher.id);
  const chapter = await createChapter(stage);
  const lesson = await createLesson(chapter);
  await insertChunk(lesson);
  const student = await createUser("STUDENT");
  await enroll(student.id, chapter);
  const teacherCookie = await login(teacher.email);
  const studentCookie = await login(student.email);
  await setCap(teacherCookie, cap);
  return { teacher, teacherCookie, student, studentCookie, chapter };
}

let t1: Awaited<ReturnType<typeof makeTeacherStudent>>;
let student3: { id: string; email: string };
let student3Cookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
    new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
  );
  vi.spyOn(geminiClient, "generateContent").mockResolvedValue(
    JSON.stringify({ answer: "الدالة الخطية هي علاقة من الدرجة الأولى.", citationRefs: ["SOURCE_1"] }),
  );

  t1 = await makeTeacherStudent(2);

  student3 = await createUser("STUDENT"); // no enrollment
  student3Cookie = await login(student3.email);
});

afterAll(async () => {
  await prisma.aiTutorUsage.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.$executeRaw`DELETE FROM content_chunks WHERE "lessonId" = ANY(${owned.lessonIds}::text[])`;
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("STORY-65 — daily AI tutor cap (E2E)", () => {
  it("teacher can read the default cap and update it", async () => {
    const fresh = await createUser("OPERATION");
    await createTeacherProfile(fresh.id);
    const cookie = await login(fresh.email);

    const read = await http("GET", "/api/teachers/profile", { cookie });
    expect(read.status).toBe(200);
    expect((read.json!.data as Record<string, unknown>).aiTutorDailyQueryLimit).toBe(20);

    const upd = await setCap(cookie, 7);
    expect(upd.status).toBe(200);
    expect((upd.json!.data as Record<string, unknown>).aiTutorDailyQueryLimit).toBe(7);
  });

  it("rejects an invalid cap value (validation)", async () => {
    const fresh = await createUser("OPERATION");
    await createTeacherProfile(fresh.id);
    const cookie = await login(fresh.email);
    expect((await setCap(cookie, -1)).status).toBe(400);
    expect((await setCap(cookie, 0)).status).toBe(400);
    expect((await http("PUT", "/api/teachers/profile", { cookie, body: { aiTutorDailyQueryLimit: 1.5 } })).status).toBe(400);
  });

  it("a student cannot update teacher settings", async () => {
    const r = await setCap(t1.studentCookie, 99);
    expect(r.status).not.toBe(200);
  });

  it("tracks usage, exposes usage-today, and enforces the cap with 429 metadata", async () => {
    await prisma.aiTutorUsage.deleteMany({ where: { studentId: t1.student.id } });

    const before = await usageToday(t1.studentCookie);
    expect(before.status).toBe(200);
    expect(before.json!.data).toMatchObject({ used: 0, limit: 2, remaining: 2 });
    expect((before.json!.data as Record<string, unknown>).resetsAt).toBeTypeOf("string");

    expect((await http("POST", "/api/tutor/ask", { cookie: t1.studentCookie, body: { question: Q } })).status).toBe(200);
    const mid = await usageToday(t1.studentCookie);
    expect(mid.json!.data).toMatchObject({ used: 1, limit: 2, remaining: 1 });

    expect((await http("POST", "/api/tutor/ask", { cookie: t1.studentCookie, body: { question: Q } })).status).toBe(200);

    const callsBefore = (geminiClient.generateContent as ReturnType<typeof vi.fn>).mock.calls.length;
    const over = await http("POST", "/api/tutor/ask", { cookie: t1.studentCookie, body: { question: Q } });
    expect(over.status).toBe(429);
    expect(over.json).toMatchObject({ limit: 2, remaining: 0 });
    expect(over.json!.resetsAt).toBeTypeOf("string");
    // Rejected request must not invoke the provider.
    const callsAfter = (geminiClient.generateContent as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it("returns the exact Arabic and English 429 messages by Accept-Language", async () => {
    // t1 student is already at the cap from the previous test.
    const ar = await fetch(`${base}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: t1.studentCookie, "Accept-Language": "ar" },
      body: JSON.stringify({ question: Q }),
    });
    expect(ar.status).toBe(429);
    expect(((await ar.json()) as Record<string, unknown>).message).toBe(
      "لقد تجاوزت الحد اليومي للأسئلة. يرجى المحاولة غداً.",
    );
    const en = await fetch(`${base}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: t1.studentCookie, "Accept-Language": "en" },
      body: JSON.stringify({ question: Q }),
    });
    expect(((await en.json()) as Record<string, unknown>).message).toBe(
      "You've exceeded your daily question limit.",
    );
  });

  it("keeps quotas independent across students", async () => {
    const other = await makeTeacherStudent(5);
    const r = await usageToday(other.studentCookie);
    expect(r.json!.data).toMatchObject({ used: 0, limit: 5, remaining: 5 });
    expect((await http("POST", "/api/tutor/ask", { cookie: other.studentCookie, body: { question: Q } })).status).toBe(200);
  });

  it("does not consume quota for no-enrollment / invalid / wrong-role / no-auth requests", async () => {
    // No-enrollment student → 401 (STORY-64) and no usage row.
    expect((await http("POST", "/api/tutor/ask", { cookie: student3Cookie, body: { question: Q } })).status).toBe(401);
    const row = await prisma.aiTutorUsage.findFirst({ where: { studentId: student3.id } });
    expect(row).toBeNull();

    // Invalid DTO → 400.
    expect((await http("POST", "/api/tutor/ask", { cookie: t1.studentCookie, body: { question: "short" } })).status).toBe(400);
    // No auth → 401.
    expect((await http("POST", "/api/tutor/ask", { body: { question: Q } })).status).toBe(401);
  });

  it("lowering the cap below used blocks further requests without resetting usage", async () => {
    const s = await makeTeacherStudent(3);
    for (let i = 0; i < 3; i++) {
      expect((await http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } })).status).toBe(200);
    }
    await setCap(s.teacherCookie, 1); // below the used count of 3
    const u = await usageToday(s.studentCookie);
    expect(u.json!.data).toMatchObject({ used: 3, limit: 1, remaining: 0 });
    expect((await http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } })).status).toBe(429);

    // Raising the cap restores allowance immediately, usage unchanged.
    await setCap(s.teacherCookie, 5);
    const u2 = await usageToday(s.studentCookie);
    expect(u2.json!.data).toMatchObject({ used: 3, limit: 5, remaining: 2 });
    expect((await http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } })).status).toBe(200);
  });

  it("protects the final slot under concurrency (exactly one success)", async () => {
    const s = await makeTeacherStudent(2);
    // Pre-fill to cap-1 so exactly one of two concurrent requests may pass.
    await prisma.aiTutorUsage.create({
      data: { studentId: s.student.id, usageDate: new Date(new Date().toISOString().slice(0, 10)), count: 1 },
    });
    const [a, b] = await Promise.all([
      http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } }),
      http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 429]);
    const row = await prisma.aiTutorUsage.findFirst({ where: { studentId: s.student.id } });
    expect(row!.count).toBe(2); // never limit + 1
  });

  it("resets by server calendar date (new day row), preserving the previous day", async () => {
    const s = await makeTeacherStudent(2);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await prisma.aiTutorUsage.create({
      data: { studentId: s.student.id, usageDate: new Date(`${yesterday}T00:00:00.000Z`), count: 2 },
    });
    // Today is a new calendar-day row → used 0 (not a rolling 24h window).
    const u = await usageToday(s.studentCookie);
    expect(u.json!.data).toMatchObject({ used: 0, limit: 2, remaining: 2 });
    expect((await http("POST", "/api/tutor/ask", { cookie: s.studentCookie, body: { question: Q } })).status).toBe(200);
    // Yesterday's row is untouched.
    const old = await prisma.aiTutorUsage.findFirst({
      where: { studentId: s.student.id, usageDate: new Date(`${yesterday}T00:00:00.000Z`) },
    });
    expect(old!.count).toBe(2);
  });
});
