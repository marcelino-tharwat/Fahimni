import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

/** STORY-66 — real HTTP/PostgreSQL E2E for teacher student-engagement stats. */

const PW = "E2ePass@123";
const DAY = 24 * 60 * 60 * 1000;
let pwHash: string;
let mobileSeq = 0;
let server: Server;
let base: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
  quizIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
  setCookie: string[];
}

async function http(method: string, path: string, cookie?: string): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
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
  const email = `seng-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({ data: { id, email, fullName, mobile, password: pwHash, role, status: "ACTIVE" } });
  owned.userIds.push(id);
  return { id, email };
}
async function createStage(teacherId: string) {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: `stage-${id.slice(0, 8)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}
async function createChapter(stageId: string) {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name: `chapter-${id.slice(0, 8)}`, sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}
async function createLesson(chapterId: string) {
  const id = randomUUID();
  await prisma.lesson.create({ data: { id, title: "Lesson", durationMinutes: 10, sortOrder: 1, chapterId } });
  owned.lessonIds.push(id);
  return id;
}
async function createQuiz(chapterId: string, teacherId: string) {
  const id = randomUUID();
  await prisma.quiz.create({ data: { id, title: "Quiz", status: "PUBLISHED", chapterId, createdBy: teacherId, questionCount: 1, totalPoints: 10 } });
  owned.quizIds.push(id);
  return id;
}
async function enroll(studentId: string, chapterId: string, enrolledAt: Date) {
  await prisma.enrollment.create({ data: { studentId, chapterId, price: 0, paymentMethod: "CASH", status: "ACTIVE", enrolledAt } });
}
async function progress(studentId: string, lessonId: string, completed: boolean, updatedAt: Date) {
  await prisma.lessonProgress.create({ data: { studentId, lessonId, completed, createdAt: updatedAt, updatedAt } });
}
async function attempt(studentId: string, quizId: string, status: "GRADED" | "IN_PROGRESS", score: number | null, updatedAt: Date) {
  await prisma.quizAttempt.create({
    data: { quizId, studentId, answers: [] as unknown as Prisma.InputJsonValue, score, totalPoints: 10, status, completedAt: status === "GRADED" ? updatedAt : null, updatedAt },
  });
}
async function loginToken(userId: string, createdAt: Date) {
  await prisma.refreshToken.create({ data: { token: randomUUID(), userId, createdAt, expiresAt: new Date(Date.now() + 7 * DAY) } });
}

// Fixtures
let t1Cookie: string;
let t2Cookie: string;
let studentCookie: string;
let chapter1a: string;
let metric: { id: string; email: string };
let t2only: { id: string; email: string };
let cross: { id: string; email: string };
const METRIC_NAME = "زهراء المنفردة";

function students(res: HttpResult) {
  return (res.json!.data as { students: Array<Record<string, unknown>> }).students;
}
function pagination(res: HttpResult) {
  return (res.json!.data as { pagination: Record<string, number> }).pagination;
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const now = Date.now();

  const teacher1 = await createUser("OPERATION", "Teacher One");
  const teacher2 = await createUser("OPERATION", "Teacher Two");
  const aStudent = await createUser("STUDENT", "Plain Student");
  studentCookie = await login(aStudent.email);

  const stage1 = await createStage(teacher1.id);
  chapter1a = await createChapter(stage1);
  const chapter1b = await createChapter(stage1);
  const l1 = await createLesson(chapter1a);
  const l2 = await createLesson(chapter1a);
  const l3 = await createLesson(chapter1a);
  const quizA = await createQuiz(chapter1a, teacher1.id);
  const quizB = await createQuiz(chapter1a, teacher1.id);
  const quizC = await createQuiz(chapter1a, teacher1.id);

  const stage2 = await createStage(teacher2.id);
  const chapter2 = await createChapter(stage2);
  const lT2 = await createLesson(chapter2);
  const quizT2 = await createQuiz(chapter2, teacher2.id);

  // Metric student: 1 chapter, 2 watched lessons, avg 90%, lastActivity = quiz time.
  metric = await createUser("STUDENT", METRIC_NAME);
  await enroll(metric.id, chapter1a, new Date(now - 95 * DAY)); // ~3 months → inactive
  await progress(metric.id, l1, true, new Date(now - 10 * DAY));
  await progress(metric.id, l2, true, new Date(now - 9 * DAY));
  await progress(metric.id, l3, false, new Date(now - 8 * DAY)); // not completed → not counted
  await progress(metric.id, lT2, true, new Date(now - 1 * DAY)); // other teacher → not counted
  await attempt(metric.id, quizA, "GRADED", 8, new Date(now - 2 * DAY)); // 80%
  await attempt(metric.id, quizB, "GRADED", 10, new Date(now - 1 * DAY)); // 100% → avg 90, newest activity
  await attempt(metric.id, quizC, "IN_PROGRESS", null, new Date(now - 3 * DAY)); // excluded
  await attempt(metric.id, quizT2, "GRADED", 5, new Date(now - 1 * DAY)); // other teacher → excluded
  await loginToken(metric.id, new Date(now - 20 * DAY)); // login older than quiz

  // Recent (active) and old (inactive) students.
  const recent = await createUser("STUDENT", "Recent Active");
  await enroll(recent.id, chapter1a, new Date(now - 5 * DAY));
  const old = await createUser("STUDENT", "Old Inactive");
  await enroll(old.id, chapter1a, new Date(now - 40 * DAY));

  // Multi-chapter (same teacher) → appears once, chapterCount 2.
  const multi = await createUser("STUDENT", "Multi Chapter");
  await enroll(multi.id, chapter1a, new Date(now - 3 * DAY));
  await enroll(multi.id, chapter1b, new Date(now - 2 * DAY));

  // Cross-teacher student (both teachers).
  cross = await createUser("STUDENT", "Cross Teacher");
  await enroll(cross.id, chapter1a, new Date(now - 2 * DAY));
  await enroll(cross.id, chapter2, new Date(now - 2 * DAY));

  // Null-activity student.
  await (async () => {
    const n = await createUser("STUDENT", "Null Activity");
    await enroll(n.id, chapter1a, new Date(now - 2 * DAY));
  })();

  // Teacher-2-only student (must be excluded for teacher1).
  t2only = await createUser("STUDENT", "T2 Only");
  await enroll(t2only.id, chapter2, new Date(now - 2 * DAY));

  // Bulk students for pagination (25) — all teacher1.
  for (let i = 0; i < 25; i++) {
    const b = await createUser("STUDENT", `Bulk ${String(i).padStart(2, "0")}`);
    await enroll(b.id, chapter1a, new Date(now - (i + 1) * DAY));
  }

  t1Cookie = await login(teacher1.email);
  t2Cookie = await login(teacher2.email);
});

afterAll(async () => {
  await prisma.quizAttempt.deleteMany({ where: { quizId: { in: owned.quizIds } } });
  await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: owned.lessonIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("STORY-66 student engagement (E2E)", () => {
  it("scopes to the teacher, deduplicates, and excludes other-teacher-only students", async () => {
    const r = await http("GET", "/api/dashboard/teacher/students?limit=100", t1Cookie);
    expect(r.status).toBe(200);
    const ids = students(r).map((s) => s.studentId);
    // No duplicates.
    expect(new Set(ids).size).toBe(ids.length);
    // Teacher-2-only student excluded.
    expect(ids).not.toContain(t2only.id);
    // Cross-teacher student included for teacher 1.
    expect(ids).toContain(cross.id);
    // Multi-chapter student appears once with chapterCount 2.
    const multi = students(r).find((s) => s.studentName === "Multi Chapter")!;
    expect(multi.enrolledChapterCount).toBe(2);
  });

  it("computes all metrics correctly for a known student", async () => {
    const r = await http("GET", `/api/dashboard/teacher/students?search=${encodeURIComponent(METRIC_NAME)}`, t1Cookie);
    expect(r.status).toBe(200);
    const list = students(r);
    expect(list).toHaveLength(1);
    const m = list[0]!;
    expect(m.studentId).toBe(metric.id);
    expect(m.studentName).toBe(METRIC_NAME);
    expect(m.enrolledChapterCount).toBe(1);
    expect(m.totalLessonsWatched).toBe(2); // l1,l2 completed; l3 not; lT2 other-teacher
    expect(m.averageQuizScore).toBe(90); // (80 + 100) / 2; quizC in-progress + quizT2 excluded
    expect(m.status).toBe("inactive"); // enrolled ~95 days ago
    expect(m.enrollmentMonths).toBeGreaterThanOrEqual(3);
    // lastActivity = newest of login(-20d), lesson(-9d), quiz(-1d) → quiz.
    expect(new Date(m.lastActivityAt as string).getTime()).toBeGreaterThan(Date.now() - 2 * DAY);
  });

  it("returns active/inactive by the 30-day rule and null metrics for no-activity", async () => {
    const r = await http("GET", "/api/dashboard/teacher/students?limit=100", t1Cookie);
    const list = students(r);
    expect(list.find((s) => s.studentName === "Recent Active")!.status).toBe("active");
    expect(list.find((s) => s.studentName === "Old Inactive")!.status).toBe("inactive");
    const n = list.find((s) => s.studentName === "Null Activity")!;
    expect(n.averageQuizScore).toBeNull();
    expect(n.totalLessonsWatched).toBe(0);
    expect(n.lastActivityAt).toBeNull();
  });

  it("paginates at 20 per page with a stable, non-overlapping second page", async () => {
    const p1 = await http("GET", "/api/dashboard/teacher/students?page=1&sortBy=name&sortOrder=asc", t1Cookie);
    const p2 = await http("GET", "/api/dashboard/teacher/students?page=2&sortBy=name&sortOrder=asc", t1Cookie);
    expect(students(p1).length).toBe(20);
    expect(pagination(p1).pageSize).toBe(20);
    expect(pagination(p1).total).toBeGreaterThanOrEqual(30);
    const ids1 = new Set(students(p1).map((s) => s.studentId));
    const overlap = students(p2).filter((s) => ids1.has(s.studentId as string));
    expect(overlap).toHaveLength(0);
  });

  it("sorts by name, averageQuizScore (nulls last), and lastActivity (nulls last)", async () => {
    // Collation-agnostic: ascending must be the exact reverse of descending
    // (DB-side ORDER BY with a deterministic tiebreak), proving sorting applies.
    const asc = await http("GET", "/api/dashboard/teacher/students?sortBy=name&sortOrder=asc&limit=100", t1Cookie);
    const desc = await http("GET", "/api/dashboard/teacher/students?sortBy=name&sortOrder=desc&limit=100", t1Cookie);
    const ascNames = students(asc).map((s) => s.studentName as string);
    const descNames = students(desc).map((s) => s.studentName as string);
    expect(ascNames).toEqual([...descNames].reverse());

    const score = await http("GET", "/api/dashboard/teacher/students?sortBy=averageQuizScore&sortOrder=desc&limit=100", t1Cookie);
    const scores = students(score).map((s) => s.averageQuizScore as number | null);
    const firstNull = scores.findIndex((v) => v === null);
    if (firstNull !== -1) expect(scores.slice(firstNull).every((v) => v === null)).toBe(true);

    const act = await http("GET", "/api/dashboard/teacher/students?sortBy=lastActivity&sortOrder=desc&limit=100", t1Cookie);
    const acts = students(act).map((s) => s.lastActivityAt as string | null);
    const firstActNull = acts.findIndex((v) => v === null);
    if (firstActNull !== -1) expect(acts.slice(firstActNull).every((v) => v === null)).toBe(true);
  });

  it("isolates teachers: teacher 2 sees their own students only", async () => {
    const r = await http("GET", "/api/dashboard/teacher/students?limit=100", t2Cookie);
    const ids = students(r).map((s) => s.studentId);
    expect(ids).toContain(t2only.id);
    expect(ids).toContain(cross.id);
    expect(ids).not.toContain(metric.id); // teacher-1-only
  });

  it("enforces auth and role", async () => {
    expect((await http("GET", "/api/dashboard/teacher/students")).status).toBe(401);
    expect((await http("GET", "/api/dashboard/teacher/students", studentCookie)).status).toBe(403);
  });

  it("rejects an invalid sort field (400)", async () => {
    expect((await http("GET", "/api/dashboard/teacher/students?sortBy=phone", t1Cookie)).status).toBe(400);
  });
});
