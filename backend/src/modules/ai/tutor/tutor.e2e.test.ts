import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Tighten the daily limit BEFORE env.ts is parsed by the app import graph.
vi.hoisted(() => {
  process.env.AI_TUTOR_DAILY_QUERY_LIMIT = "3";
});

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../../app.js";
import { prisma } from "../../../config/database.js";
import { geminiClient } from "../../../shared/services/geminiClient.js";

const DIM = 3072;
const LIMIT = 3;
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
  json: { success?: boolean; message?: string; data?: unknown; statusCode?: number } | null;
  setCookie: string[];
  ms: number;
}

async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown } = {},
): Promise<HttpResult> {
  const t0 = Date.now();
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
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [], ms: Date.now() - t0 };
}

async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function createUser(role: "OPERATION" | "STUDENT"): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `tutor64-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({
    data: { id, email, fullName: `E2E ${role}`, mobile, password: pwHash, role, status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createStage(teacherId: string): Promise<string> {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: `stage-${id.slice(0, 8)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}
async function createChapter(stageId: string, name: string): Promise<string> {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name, sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}
async function createLesson(chapterId: string, title: string): Promise<string> {
  const id = randomUUID();
  await prisma.lesson.create({ data: { id, title, durationMinutes: 10, sortOrder: 1, chapterId } });
  owned.lessonIds.push(id);
  return id;
}
async function enroll(studentId: string, chapterId: string): Promise<void> {
  const e = await prisma.enrollment.create({ data: { studentId, chapterId, price: 0, paymentMethod: "CASH", status: "ACTIVE" } });
  owned.enrollmentIds.push(e.id);
}
async function insertChunk(lessonId: string, content: string, spike: number): Promise<void> {
  const arr = new Array<number>(DIM).fill(0);
  arr[spike] = 1;
  const vectorStr = `[${arr.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO content_chunks (id, content, embedding, "lessonId", metadata, "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${content}, ${vectorStr}::vector, ${lessonId}, ${"{}"}::jsonb, NOW(), NOW())`;
}
async function resetUsage(studentId: string): Promise<void> {
  await prisma.aiTutorUsage.deleteMany({ where: { studentId } });
}

let s1: { id: string; email: string };
let s2: { id: string; email: string };
let t1: { id: string; email: string };
let s1Cookie: string;
let s2Cookie: string;
let t1Cookie: string;
let lesson1: string;
let lessonInaccessible: string;

const validQuestion = "اشرح لي مفهوم الدالة الخطية بالتفصيل من فضلك";

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  s1 = await createUser("STUDENT");
  s2 = await createUser("STUDENT");
  t1 = await createUser("OPERATION");

  const stage1 = await createStage(t1.id);
  const chapter1 = await createChapter(stage1, "الجبر");
  lesson1 = await createLesson(chapter1, "الدوال الخطية");

  // An inaccessible lesson (different teacher/stage, s1 not enrolled).
  const t2 = await createUser("OPERATION");
  const stage2 = await createStage(t2.id);
  const chapter2 = await createChapter(stage2, "الفيزياء");
  lessonInaccessible = await createLesson(chapter2, "قوانين نيوتن");

  await enroll(s1.id, chapter1);
  await insertChunk(lesson1, "الدالة الخطية علاقة من الدرجة الأولى.", 0);
  await insertChunk(lessonInaccessible, "القوة = الكتلة × التسارع.", 0);

  s1Cookie = await login(s1.email);
  s2Cookie = await login(s2.email);
  t1Cookie = await login(t1.email);
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
    new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
  );
  vi.spyOn(geminiClient, "generateContent").mockResolvedValue(
    JSON.stringify({ answer: "الدالة الخطية هي علاقة من الدرجة الأولى.", citationRefs: ["SOURCE_1"] }),
  );
});

afterAll(async () => {
  await prisma.aiTutorUsage.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.$executeRaw`DELETE FROM content_chunks WHERE "lessonId" = ANY(${owned.lessonIds}::text[])`;
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("POST /api/tutor/ask (E2E)", () => {
  it("answers a valid question for an enrolled student with public-only citations", async () => {
    await resetUsage(s1.id);
    const r = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } });

    expect(r.status).toBe(200);
    const data = r.json!.data as { answer: string; citations: Array<Record<string, unknown>> };
    expect(typeof data.answer).toBe("string");
    expect(data.citations.length).toBeGreaterThan(0);
    for (const c of data.citations) {
      expect(Object.keys(c).sort()).toEqual(["chapterName", "lessonId", "lessonTitle"]);
      expect(c).not.toHaveProperty("relevanceScore");
    }
    expect(data.citations.map((c) => c.lessonId)).toContain(lesson1);
    expect(r.ms).toBeLessThan(19_000);
  });

  it("never cites an inaccessible lesson", async () => {
    await resetUsage(s1.id);
    vi.spyOn(geminiClient, "generateContent").mockResolvedValue(
      JSON.stringify({ answer: "إجابة", citationRefs: ["SOURCE_1", "SOURCE_2", "SOURCE_3"] }),
    );
    const r = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } });
    const data = r.json!.data as { citations: Array<{ lessonId: string }> };
    expect(data.citations.map((c) => c.lessonId)).not.toContain(lessonInaccessible);
    expect(data.citations.every((c) => c.lessonId === lesson1)).toBe(true);
  });

  it("returns 401 for a student with no enrollment", async () => {
    const r = await http("POST", "/api/tutor/ask", { cookie: s2Cookie, body: { question: validQuestion } });
    expect(r.status).toBe(401);
  });

  it("returns 401 without authentication", async () => {
    const r = await http("POST", "/api/tutor/ask", { body: { question: validQuestion } });
    expect(r.status).toBe(401);
  });

  it("returns 403 for a non-student role", async () => {
    const r = await http("POST", "/api/tutor/ask", { cookie: t1Cookie, body: { question: validQuestion } });
    expect(r.status).toBe(403);
  });

  it("returns 400 for a too-short question", async () => {
    const r = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: "قصير" } });
    expect(r.status).toBe(400);
  });

  it("returns 400 for a too-long question", async () => {
    const r = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: "ط".repeat(501) } });
    expect(r.status).toBe(400);
  });

  it("returns 400 for unknown body fields", async () => {
    const r = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion, studentId: "evil" } });
    expect(r.status).toBe(400);
  });

  it("enforces the daily limit (429 after the configured allowance)", async () => {
    await resetUsage(s1.id);
    for (let i = 0; i < LIMIT; i++) {
      const ok = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } });
      expect(ok.status).toBe(200);
    }
    const over = await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } });
    expect(over.status).toBe(429);
  });

  it("keeps quotas independent across students", async () => {
    // s1 is at its limit from the previous test; a different enrolled student works.
    const s3 = await createUser("STUDENT");
    const stage = await createStage(t1.id);
    const chapter = await createChapter(stage, "كيمياء");
    await enroll(s3.id, chapter);
    const s3Cookie = await login(s3.email);
    await resetUsage(s3.id);
    const r = await http("POST", "/api/tutor/ask", { cookie: s3Cookie, body: { question: validQuestion } });
    expect(r.status).toBe(200);
  });

  it("protects the final quota slot under concurrency (atomic claim)", async () => {
    await resetUsage(s1.id);
    // Pre-fill to LIMIT-1 so exactly one of two concurrent requests may pass.
    await prisma.aiTutorUsage.create({
      data: { studentId: s1.id, usageDate: new Date(new Date().toISOString().slice(0, 10)), count: LIMIT - 1 },
    });
    const [a, b] = await Promise.all([
      http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } }),
      http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: validQuestion } }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 429]);
  });

  it("keeps requests session-independent (no conversation memory)", async () => {
    await resetUsage(s1.id);
    const gen = vi.spyOn(geminiClient, "generateContent").mockResolvedValue(
      JSON.stringify({ answer: "إجابة", citationRefs: ["SOURCE_1"] }),
    );
    const q1 = "ما هو تعريف الدالة الخطية في الرياضيات؟";
    const q2 = "ما الفرق بين الدالة الخطية والتربيعية تحديداً؟";
    await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: q1 } });
    await http("POST", "/api/tutor/ask", { cookie: s1Cookie, body: { question: q2 } });

    const prompt2 = gen.mock.calls[gen.mock.calls.length - 1]![0] as string;
    expect(prompt2).toContain(q2);
    expect(prompt2).not.toContain(q1);
  });
});
