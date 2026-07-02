import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

/** STORY-68 — real HTTP/PostgreSQL E2E for teacher quiz results + CSV export. */

const PW = "E2ePass@123";
let pwHash: string;
let mobileSeq = 0;
let server: Server;
let base: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  quizIds: [] as string[],
  attemptIds: [] as string[],
  enrollmentIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  contentType: string | null;
}

async function http(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: HttpResult["json"] = null;
  try {
    json = JSON.parse(text) as HttpResult["json"];
  } catch {
    json = null;
  }
  return { status: res.status, json, text, contentType: res.headers.get("content-type") };
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  const sc = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = sc.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${res.status}`);
  return cookie;
}

async function createUser(role: "OPERATION" | "STUDENT", fullName: string) {
  const id = randomUUID();
  const email = `qresults-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({ data: { id, email, fullName, mobile, password: pwHash, role, status: "ACTIVE" } });
  owned.userIds.push(id);
  return { id, email };
}

const MCQ = randomUUID();
const ESSAY = randomUUID();
let teacher1: { id: string; email: string };
let teacher2: { id: string; email: string };
let student1: { id: string; email: string };
let quizId: string;
let foreignQuizId: string;
let gradedAttemptId: string;
let pendingAttemptId: string;
let t1Cookie: string;
let t2Cookie: string;
let s1Cookie: string;

function results(mcqGraded: boolean, essay: "pending" | "graded"): Prisma.InputJsonValue {
  return [
    { questionId: MCQ, type: "MCQ", answer: "القاهرة", result: mcqGraded ? "correct" : "incorrect", awardedPoints: mcqGraded ? 2 : 0, maxPoints: 2, feedback: null },
    { questionId: ESSAY, type: "ESSAY", answer: "إجابة مقالية", result: essay, awardedPoints: essay === "graded" ? 3 : null, maxPoints: 3, feedback: essay === "graded" ? "جيد" : null },
  ] as unknown as Prisma.InputJsonValue;
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  teacher1 = await createUser("OPERATION", "Teacher One");
  teacher2 = await createUser("OPERATION", "Teacher Two");
  student1 = await createUser("STUDENT", "أحمد");
  const student2 = await createUser("STUDENT", "زياد");

  const stage = await prisma.stage.create({ data: { id: randomUUID(), name: "Stage", sortOrder: 1, teacherId: teacher1.id } });
  owned.stageIds.push(stage.id);
  const chapter = await prisma.chapter.create({ data: { id: randomUUID(), name: "Chapter", sortOrder: 1, stageId: stage.id } });
  owned.chapterIds.push(chapter.id);

  quizId = randomUUID();
  await prisma.quiz.create({ data: { id: quizId, title: "Quiz", status: "PUBLISHED", chapterId: chapter.id, createdBy: teacher1.id, questionCount: 2, totalPoints: 5, publishedAt: new Date() } });
  owned.quizIds.push(quizId);
  await prisma.question.create({ data: { id: MCQ, quizId, type: "MCQ", text: "ما العاصمة؟", options: ["القاهرة", "الرياض"], correctAnswer: "القاهرة", points: 2, sortOrder: 1 } });
  await prisma.question.create({ data: { id: ESSAY, quizId, type: "ESSAY", text: "اشرح", options: [], correctAnswer: null, points: 3, sortOrder: 2 } });

  foreignQuizId = randomUUID();
  await prisma.quiz.create({ data: { id: foreignQuizId, title: "Other", status: "DRAFT", createdBy: teacher2.id, questionCount: 0, totalPoints: 0 } });
  owned.quizIds.push(foreignQuizId);

  for (const sid of [student1.id, student2.id]) {
    const e = await prisma.enrollment.create({ data: { studentId: sid, chapterId: chapter.id, price: 0, paymentMethod: "FREE", status: "ACTIVE" } });
    owned.enrollmentIds.push(e.id);
  }

  // student1 (أحمد): fully graded, score 5. student2 (زياد): essay pending, score 2.
  const a1 = await prisma.quizAttempt.create({ data: { id: randomUUID(), quizId, studentId: student1.id, answers: results(true, "graded"), score: 5, totalPoints: 5, status: "GRADED", completedAt: new Date("2026-06-28T09:00:00Z") } });
  gradedAttemptId = a1.id; owned.attemptIds.push(a1.id);
  const a2 = await prisma.quizAttempt.create({ data: { id: randomUUID(), quizId, studentId: student2.id, answers: results(true, "pending"), score: 2, totalPoints: 5, status: "COMPLETED", completedAt: new Date("2026-06-28T10:00:00Z") } });
  pendingAttemptId = a2.id; owned.attemptIds.push(a2.id);

  t1Cookie = await login(teacher1.email);
  t2Cookie = await login(teacher2.email);
  s1Cookie = await login(student1.email);
});

afterAll(async () => {
  await prisma.quizAttempt.deleteMany({ where: { id: { in: owned.attemptIds } } });
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.question.deleteMany({ where: { quizId: { in: owned.quizIds } } });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("STORY-68 quiz results (E2E)", () => {
  it("returns all attempts with per-question breakdown (default score desc)", async () => {
    const r = await http("GET", `/api/quizzes/${quizId}/results`, { cookie: t1Cookie });
    expect(r.status).toBe(200);
    const data = r.json!.data as { count: number; results: Array<Record<string, unknown>> };
    expect(data.count).toBe(2);
    expect(data.results.map((x) => x.studentName)).toEqual(["أحمد", "زياد"]); // 5 before 2
    const first = data.results[0] as { questions: unknown[] };
    expect(first.questions).toHaveLength(2);
  });

  it("sorts by student name when requested", async () => {
    const r = await http("GET", `/api/quizzes/${quizId}/results?sortBy=studentName&sortOrder=asc`, { cookie: t1Cookie });
    expect(r.status).toBe(200);
    expect((r.json!.data as { results: Array<{ studentName: string }> }).results.map((x) => x.studentName)).toEqual(["أحمد", "زياد"]);
  });

  it("rejects an invalid sort param (400)", async () => {
    const r = await http("GET", `/api/quizzes/${quizId}/results?sortBy=bogus`, { cookie: t1Cookie });
    expect(r.status).toBe(400);
  });

  it("ungraded lists only the pending-essay attempt", async () => {
    const r = await http("GET", `/api/quizzes/${quizId}/results/ungraded`, { cookie: t1Cookie });
    expect(r.status).toBe(200);
    const data = r.json!.data as { count: number; results: Array<{ studentName: string }> };
    expect(data.count).toBe(1);
    expect(data.results[0]!.studentName).toBe("زياد");
  });

  it("grades the essay (PATCH) and recalculates the score; ungraded then empties", async () => {
    const g = await http("PATCH", `/api/attempts/${pendingAttemptId}/grade-essays`, {
      cookie: t1Cookie,
      body: { grades: [{ questionId: ESSAY, awardedPoints: 3, feedback: "ممتاز" }] },
    });
    expect(g.status).toBe(200);
    expect((g.json!.data as { score: number; status: string }).score).toBe(5);

    const ung = await http("GET", `/api/quizzes/${quizId}/results/ungraded`, { cookie: t1Cookie });
    expect((ung.json!.data as { count: number }).count).toBe(0);
  });

  it("exports valid CSV (text/csv) for the owner", async () => {
    const r = await http("GET", `/api/quizzes/${quizId}/results/export`, { cookie: t1Cookie });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("text/csv");
    expect(r.text).toContain("Student Name,Status,Score");
    expect(r.text).toContain("أحمد");
    expect(r.text).toContain("زياد");
  });

  it("enforces ownership and role", async () => {
    // Another teacher cannot read this quiz's results or export.
    expect((await http("GET", `/api/quizzes/${quizId}/results`, { cookie: t2Cookie })).status).toBe(403);
    expect((await http("GET", `/api/quizzes/${quizId}/results/export`, { cookie: t2Cookie })).status).toBe(403);
    // A student is rejected by role.
    expect((await http("GET", `/api/quizzes/${quizId}/results`, { cookie: s1Cookie })).status).toBe(403);
    // Unknown quiz → 404.
    expect((await http("GET", `/api/quizzes/${randomUUID()}/results`, { cookie: t1Cookie })).status).toBe(404);
  });

  it("PATCH and POST grade-essays are both routed (alias)", async () => {
    // Already graded → 409 from both methods (proves both reach the handler).
    const patch = await http("PATCH", `/api/attempts/${gradedAttemptId}/grade-essays`, { cookie: t1Cookie, body: { grades: [{ questionId: ESSAY, awardedPoints: 1 }] } });
    const post = await http("POST", `/api/attempts/${gradedAttemptId}/grade-essays`, { cookie: t1Cookie, body: { grades: [{ questionId: ESSAY, awardedPoints: 1 }] } });
    expect(patch.status).toBe(409);
    expect(post.status).toBe(409);
  });
});
