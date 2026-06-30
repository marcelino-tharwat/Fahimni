import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Role } from "../../generated/prisma/client.js";

// ── Test harness ──────────────────────────────────────────────────────────
let server: Server;
let base: string;
const PW = "E2ePass@123";
let pwHash: string;
let mobileSeq = 0;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  quizIds: [] as string[],
  enrollmentIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: { success?: boolean; message?: string; data?: unknown } | null;
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
  const r = await http("POST", "/api/v1/auth/login", {
    body: { email, password: PW },
  });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

function uniq(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

async function createUser(role: Role): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${uniq("user")}@e2e.test`;
  mobileSeq += 1;
  const mobile = `019${String(mobileSeq).padStart(8, "0")}`;
  await prisma.user.create({
    data: { id, email, fullName: `E2E ${role}`, mobile, password: pwHash, role, status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createStage(teacherId: string): Promise<string> {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: uniq("stage"), sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}

async function createChapter(stageId: string): Promise<string> {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name: uniq("chapter"), sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}

async function enroll(studentId: string, chapterId: string): Promise<void> {
  const e = await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "CASH", status: "ACTIVE" },
  });
  owned.enrollmentIds.push(e.id);
}

interface QuizFixture {
  quizId: string;
  mcqId: string;
  tfId: string;
  essayId: string;
}

async function createDraftQuiz(teacherId: string): Promise<QuizFixture> {
  const quizId = randomUUID();
  await prisma.quiz.create({
    data: { id: quizId, title: uniq("quiz"), createdBy: teacherId, status: "DRAFT" },
  });
  owned.quizIds.push(quizId);

  const mcqId = randomUUID();
  const tfId = randomUUID();
  const essayId = randomUUID();
  await prisma.question.create({
    data: { id: mcqId, quizId, type: "MCQ", text: "اختر الإجابة الصحيحة", options: ["أ", "ب", "ج", "د"], correctAnswer: "ب", points: 1, sortOrder: 1 },
  });
  await prisma.question.create({
    data: { id: tfId, quizId, type: "TRUE_FALSE", text: "هذه عبارة", options: ["صح", "خطأ"], correctAnswer: "صح", points: 1, sortOrder: 2 },
  });
  await prisma.question.create({
    data: { id: essayId, quizId, type: "ESSAY", text: "اشرح", options: [], correctAnswer: null, points: 5, sortOrder: 3 },
  });
  return { quizId, mcqId, tfId, essayId };
}

async function publishViaApi(quizId: string, chapterId: string, teacherCookie: string): Promise<void> {
  const a = await http("POST", `/api/quizzes/${quizId}/assign`, { cookie: teacherCookie, body: { chapterId } });
  expect(a.status).toBe(200);
  const p = await http("PATCH", `/api/quizzes/${quizId}/publish`, { cookie: teacherCookie });
  expect(p.status).toBe(200);
}

// Shared fixtures
let t1: { id: string; email: string };
let t2: { id: string; email: string };
let s1: { id: string; email: string };
let s2: { id: string; email: string };
let chapterId: string;
let t1Cookie: string;
let t2Cookie: string;
let s1Cookie: string;
let s2Cookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  t1 = await createUser("OPERATION");
  t2 = await createUser("OPERATION");
  s1 = await createUser("STUDENT");
  s2 = await createUser("STUDENT");

  const stageId = await createStage(t1.id);
  chapterId = await createChapter(stageId);
  await enroll(s1.id, chapterId);

  t1Cookie = await login(t1.email);
  t2Cookie = await login(t2.email);
  s1Cookie = await login(s1.email);
  s2Cookie = await login(s2.email);
});

afterAll(async () => {
  // Clean only test-owned records (child-first; quiz cascade removes questions+attempts).
  await prisma.auditLog.deleteMany({
    where: { OR: [{ userId: { in: owned.userIds } }, { scopeTeacherId: { in: owned.userIds } }] },
  });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("STORY-48 — full HTTP + DB journey", () => {
  it("authenticates each role with isolated cookies", async () => {
    expect(t1Cookie).toContain("access_token=");
    const me = await http("GET", "/api/v1/auth/me", { cookie: s1Cookie });
    expect(me.status).toBe(200);
    expect((me.json?.data as { user: { role: string } }).user.role).toBe("STUDENT");
    const meT = await http("GET", "/api/v1/auth/me", { cookie: t2Cookie });
    expect((meT.json?.data as { user: { role: string } }).user.role).toBe("OPERATION");
  });

  it("runs assign → publish → immutability → taking → grading", async () => {
    const fx = await createDraftQuiz(t1.id);

    // ── Assignment ──
    const crossAssign = await http("POST", `/api/quizzes/${fx.quizId}/assign`, {
      cookie: t2Cookie,
      body: { chapterId },
    });
    expect([403, 404]).toContain(crossAssign.status); // Teacher 2 doesn't own the quiz

    const assign = await http("POST", `/api/quizzes/${fx.quizId}/assign`, {
      cookie: t1Cookie,
      body: { chapterId },
    });
    expect(assign.status).toBe(200);
    expect((assign.json?.data as { chapterId: string }).chapterId).toBe(chapterId);

    // ── Publishing ──
    const pub = await http("PATCH", `/api/quizzes/${fx.quizId}/publish`, { cookie: t1Cookie });
    expect(pub.status).toBe(200);
    const pubData = pub.json?.data as { status: string; publishedAt: string | null };
    expect(pubData.status).toBe("PUBLISHED");
    expect(pubData.publishedAt).toBeTruthy();

    const pubAgain = await http("PATCH", `/api/quizzes/${fx.quizId}/publish`, { cookie: t1Cookie });
    expect(pubAgain.status).toBe(409);

    // ── Immutability of published questions ──
    const upd = await http("PUT", `/api/quizzes/${fx.quizId}/questions/${fx.mcqId}`, {
      cookie: t1Cookie,
      body: { content: "تعديل ممنوع" },
    });
    expect(upd.status).toBe(403);
    const del = await http("DELETE", `/api/quizzes/${fx.quizId}/questions/${fx.mcqId}`, { cookie: t1Cookie });
    expect(del.status).toBe(403);
    const add = await http("POST", `/api/quizzes/${fx.quizId}/questions`, {
      cookie: t1Cookie,
      body: { type: "MCQ", content: "سؤال جديد", options: { a: "1", b: "2" }, correctAnswer: "1" },
    });
    expect(add.status).toBe(403);

    // ── Chapter quizzes (no correctAnswer) ──
    const chQuizzes = await http("GET", `/api/chapters/${chapterId}/quizzes`, { cookie: s1Cookie });
    expect(chQuizzes.status).toBe(200);
    const chList = chQuizzes.json?.data as Array<{ id: string }>;
    expect(chList.some((q) => q.id === fx.quizId)).toBe(true);
    expect(JSON.stringify(chQuizzes.json)).not.toContain("correctAnswer");

    // ── Assigned quizzes ──
    const assigned = await http("GET", "/api/quizzes/assigned", { cookie: s1Cookie });
    expect(assigned.status).toBe(200);
    const aList = assigned.json?.data as Array<{ id: string }>;
    expect(aList.some((q) => q.id === fx.quizId)).toBe(true);
    expect(JSON.stringify(assigned.json)).not.toContain("correctAnswer");

    const assignedS2 = await http("GET", "/api/quizzes/assigned", { cookie: s2Cookie });
    expect(assignedS2.status).toBe(200);
    expect((assignedS2.json?.data as Array<{ id: string }>).some((q) => q.id === fx.quizId)).toBe(false);

    // ── Start attempt ──
    const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s1Cookie });
    expect(start.status).toBe(201);
    const startData = start.json?.data as {
      attemptId: string;
      status: string;
      questions: Array<{ id: string }>;
    };
    expect(startData.status).toBe("IN_PROGRESS");
    expect(startData.questions).toHaveLength(3);
    expect(JSON.stringify(start.json)).not.toContain("correctAnswer");
    const attemptId = startData.attemptId;

    // Re-starting an IN_PROGRESS attempt RESUMES it (idempotent 201 with the same
    // attempt) — the frontend QuizPage relies on this for refresh/double-mount.
    // It must never create a second row. (A finished attempt would return 409.)
    const startAgain = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s1Cookie });
    expect(startAgain.status).toBe(201);
    expect((startAgain.json?.data as { attemptId: string }).attemptId).toBe(attemptId);
    expect(await prisma.quizAttempt.count({ where: { quizId: fx.quizId, studentId: s1.id } })).toBe(1);

    // ── Partial submit rejected, nothing persisted ──
    const partial = await http("POST", `/api/attempts/${attemptId}/submit`, {
      cookie: s1Cookie,
      body: { answers: [{ questionId: fx.mcqId, answer: "ب" }, { questionId: fx.tfId, answer: "صح" }] },
    });
    expect(partial.status).toBe(400);
    const afterPartial = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(afterPartial.status).toBe("IN_PROGRESS");
    expect(afterPartial.score).toBeNull();
    expect(Array.isArray(afterPartial.answers) ? (afterPartial.answers as unknown[]).length : -1).toBe(0);

    // ── Complete submit (correct MCQ, incorrect TF, essay) ──
    const submit = await http("POST", `/api/attempts/${attemptId}/submit`, {
      cookie: s1Cookie,
      body: {
        answers: [
          { questionId: fx.mcqId, answer: "ب" }, // correct
          { questionId: fx.tfId, answer: "خطأ" }, // incorrect
          { questionId: fx.essayId, answer: "إجابة مقالية مفصلة" },
        ],
      },
    });
    expect(submit.status).toBe(200);
    const sub = submit.json?.data as {
      status: string;
      quizTitle: string;
      score: number;
      totalPoints: number;
      percentage: number;
      pendingEssayCount: number;
      isFinal: boolean;
      results: Array<{
        questionId: string;
        type: string;
        questionText: string;
        options: string[] | null;
        studentAnswer: string;
        correctAnswer: string | null;
        result: string;
        awardedPoints: number | null;
        maxPoints: number;
      }>;
    };
    expect(sub.status).toBe("COMPLETED");
    expect(sub.score).toBe(1);
    expect(sub.totalPoints).toBe(7);
    expect(sub.percentage).toBe(14.29);
    expect(sub.pendingEssayCount).toBe(1);
    expect(sub.isFinal).toBe(false);
    expect(typeof sub.quizTitle).toBe("string");
    expect(sub.quizTitle.length).toBeGreaterThan(0);
    const byId = new Map(sub.results.map((r) => [r.questionId, r]));
    expect(byId.get(fx.mcqId)!.result).toBe("correct");
    expect(byId.get(fx.tfId)!.result).toBe("incorrect");
    expect(byId.get(fx.essayId)!.result).toBe("pending");
    expect(byId.get(fx.essayId)!.awardedPoints).toBeNull();
    // SCRUM-423: the post-submission response now enriches each result with the
    // question text, options, the student's answer and the correct answer.
    expect(byId.get(fx.mcqId)!.questionText).toBe("اختر الإجابة الصحيحة");
    expect(byId.get(fx.mcqId)!.studentAnswer).toBe("ب");
    expect(byId.get(fx.mcqId)!.correctAnswer).toBe("ب");
    expect(byId.get(fx.mcqId)!.options).toEqual(["أ", "ب", "ج", "د"]);
    expect(byId.get(fx.tfId)!.correctAnswer).toBe("صح");
    expect(byId.get(fx.essayId)!.correctAnswer).toBeNull();
    const afterSubmit = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(afterSubmit.completedAt).not.toBeNull();

    // ── Duplicate submit ──
    const dup = await http("POST", `/api/attempts/${attemptId}/submit`, {
      cookie: s1Cookie,
      body: {
        answers: [
          { questionId: fx.mcqId, answer: "أ" },
          { questionId: fx.tfId, answer: "صح" },
          { questionId: fx.essayId, answer: "محاولة تغيير" },
        ],
      },
    });
    expect(dup.status).toBe(409);
    const unchanged = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(unchanged.score).toBe(1); // not overwritten

    // ── Unauthorized grading ──
    const studentGrade = await http("POST", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: s1Cookie,
      body: { grades: [{ questionId: fx.essayId, awardedPoints: 5 }] },
    });
    expect(studentGrade.status).toBe(403);
    const otherTeacherGrade = await http("POST", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: t2Cookie,
      body: { grades: [{ questionId: fx.essayId, awardedPoints: 5 }] },
    });
    expect([403, 404]).toContain(otherTeacherGrade.status);

    // ── Excessive points rejected ──
    const tooMany = await http("POST", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: t1Cookie,
      body: { grades: [{ questionId: fx.essayId, awardedPoints: 999 }] },
    });
    expect(tooMany.status).toBe(400);

    // ── Teacher grades the essay ──
    const grade = await http("POST", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: t1Cookie,
      body: { grades: [{ questionId: fx.essayId, awardedPoints: 4, feedback: "جيد" }] },
    });
    expect(grade.status).toBe(200);
    const g = grade.json?.data as {
      status: string;
      score: number;
      totalPoints: number;
      percentage: number;
      pendingEssayCount: number;
      isFinal: boolean;
    };
    expect(g.status).toBe("GRADED");
    expect(g.score).toBe(5); // 1 (mcq) + 4 (essay)
    expect(g.totalPoints).toBe(7);
    expect(g.percentage).toBe(71.43);
    expect(g.pendingEssayCount).toBe(0);
    expect(g.isFinal).toBe(true);

    const gradeAgain = await http("POST", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: t1Cookie,
      body: { grades: [{ questionId: fx.essayId, awardedPoints: 1 }] },
    });
    expect(gradeAgain.status).toBe(409);

    // ── Database integrity ──
    const finalAttempts = await prisma.quizAttempt.findMany({ where: { quizId: fx.quizId, studentId: s1.id } });
    expect(finalAttempts).toHaveLength(1);
    const fa = finalAttempts[0]!;
    expect(fa.status).toBe("GRADED");
    expect(fa.score).toBe(5);
    const states = (fa.answers as Array<{ result: string }>).map((r) => r.result).sort();
    expect(states).toEqual(["correct", "graded", "incorrect"]);
  });

  it("rejects an unauthenticated start and a wrong-role start", async () => {
    const fx = await createDraftQuiz(t1.id);
    await publishViaApi(fx.quizId, chapterId, t1Cookie);

    const noAuth = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, {});
    expect(noAuth.status).toBe(401);

    const teacherStart = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: t1Cookie });
    expect(teacherStart.status).toBe(403);

    const unenrolled = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s2Cookie });
    expect(unenrolled.status).toBe(403);
  });
});

describe("STORY-48 — concurrency", () => {
  it("creates exactly one attempt under simultaneous starts", async () => {
    const fx = await createDraftQuiz(t1.id);
    await publishViaApi(fx.quizId, chapterId, t1Cookie);

    const [a, b] = await Promise.all([
      http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s1Cookie }),
      http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s1Cookie }),
    ]);
    // Both requests succeed idempotently (P2002 recovery) and resolve to the SAME
    // single attempt — never a duplicate row, never a 500.
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((a.json?.data as { attemptId: string }).attemptId).toBe(
      (b.json?.data as { attemptId: string }).attemptId,
    );
    expect(await prisma.quizAttempt.count({ where: { quizId: fx.quizId, studentId: s1.id } })).toBe(1);
  });

  it("submits exactly once under simultaneous submits", async () => {
    const fx = await createDraftQuiz(t1.id);
    await publishViaApi(fx.quizId, chapterId, t1Cookie);

    const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: s1Cookie });
    expect(start.status).toBe(201);
    const attemptId = (start.json?.data as { attemptId: string }).attemptId;

    const body = {
      answers: [
        { questionId: fx.mcqId, answer: "ب" },
        { questionId: fx.tfId, answer: "صح" },
        { questionId: fx.essayId, answer: "نص" },
      ],
    };
    const [a, b] = await Promise.all([
      http("POST", `/api/attempts/${attemptId}/submit`, { cookie: s1Cookie, body }),
      http("POST", `/api/attempts/${attemptId}/submit`, { cookie: s1Cookie, body }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const attempt = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(["COMPLETED", "GRADED"]).toContain(attempt.status);
    // MCQ correct (1) + TF correct (1) + essay pending (0) → score 2, written once.
    expect(attempt.score).toBe(2);
  });
});
