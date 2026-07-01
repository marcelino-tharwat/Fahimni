import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "E2ePass@123";
let pwHash: string;

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

async function createUser(role: "STUDENT" | "OPERATION") {
  const id = randomUUID();
  const email = `${uniq("user")}@e2e.test`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName: `E2E ${role}`,
      mobile: `019${randomUUID().replace(/-/g, "").slice(0, 8)}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createStage(teacherId: string) {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: uniq("stage"), sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}

async function createChapter(stageId: string) {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name: uniq("chapter"), sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}

async function enroll(studentId: string, chapterId: string) {
  const e = await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "CASH", status: "ACTIVE" },
  });
  owned.enrollmentIds.push(e.id);
}

async function createPublishedQuiz(
  teacherId: string,
  chapterId: string,
  teacherCookie: string,
  durationMinutes: number,
) {
  const quizId = randomUUID();
  await prisma.quiz.create({
    data: {
      id: quizId,
      title: uniq("quiz"),
      createdBy: teacherId,
      status: "DRAFT",
      durationMinutes,
    },
  });
  owned.quizIds.push(quizId);

  const mcqId = randomUUID();
  const tfId = randomUUID();
  await prisma.question.create({
    data: {
      id: mcqId,
      quizId,
      type: "MCQ",
      text: "سؤال",
      options: ["أ", "ب"],
      correctAnswer: "أ",
      points: 1,
      sortOrder: 1,
    },
  });
  await prisma.question.create({
    data: {
      id: tfId,
      quizId,
      type: "TRUE_FALSE",
      text: "عبارة",
      options: ["صح", "خطأ"],
      correctAnswer: "صح",
      points: 1,
      sortOrder: 2,
    },
  });

  const assign = await http("POST", `/api/quizzes/${quizId}/assign`, {
    cookie: teacherCookie,
    body: { chapterId },
  });
  expect(assign.status).toBe(200);
  const pub = await http("PATCH", `/api/quizzes/${quizId}/publish`, { cookie: teacherCookie });
  expect(pub.status).toBe(200);

  return { quizId, mcqId, tfId };
}

let teacher: { id: string; email: string };
let student: { id: string; email: string };
let chapterId: string;
let teacherCookie: string;
let studentCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  teacher = await createUser("OPERATION");
  student = await createUser("STUDENT");
  const stageId = await createStage(teacher.id);
  chapterId = await createChapter(stageId);
  await enroll(student.id, chapterId);
  teacherCookie = await login(teacher.email);
  studentCookie = await login(student.email);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { userId: { in: owned.userIds } },
  });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("Quiz attempt timing and timeout finalization", () => {
  it("returns configured durationMinutes in start response (5, 20, 45)", async () => {
    for (const minutes of [5, 20, 45]) {
      const fx = await createPublishedQuiz(teacher.id, chapterId, teacherCookie, minutes);
      const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, {
        cookie: studentCookie,
      });
      expect(start.status).toBe(201);
      const data = start.json?.data as {
        durationMinutes: number;
        expiresAt: string;
        startedAt: string;
      };
      expect(data.durationMinutes).toBe(minutes);
      const started = Date.parse(data.startedAt);
      const expires = Date.parse(data.expiresAt);
      expect(expires - started).toBe(minutes * 60_000);
    }
  });

  it("resumes the same attempt with the same deadline", async () => {
    const fx = await createPublishedQuiz(teacher.id, chapterId, teacherCookie, 10);
    const first = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: studentCookie });
    const second = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: studentCookie });
    const a = first.json?.data as { attemptId: string; expiresAt: string };
    const b = second.json?.data as { attemptId: string; expiresAt: string };
    expect(b.attemptId).toBe(a.attemptId);
    expect(b.expiresAt).toBe(a.expiresAt);
  });

  it("persists draft answers and finalizes on timeout with TIME_EXPIRED", async () => {
    const fx = await createPublishedQuiz(teacher.id, chapterId, teacherCookie, 5);
    const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: studentCookie });
    const { attemptId } = start.json?.data as { attemptId: string };

    const save = await http("PATCH", `/api/attempts/${attemptId}/answers`, {
      cookie: studentCookie,
      body: { answers: [{ questionId: fx.mcqId, answer: "أ" }] },
    });
    expect(save.status).toBe(200);

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const timeoutSubmit = await http("POST", `/api/attempts/${attemptId}/submit`, {
      cookie: studentCookie,
      body: { answers: [], submissionReason: "TIME_EXPIRED" },
    });
    expect(timeoutSubmit.status).toBe(200);
    const sub = timeoutSubmit.json?.data as { status: string; score: number };
    expect(sub.status).toBe("GRADED");
    expect(sub.score).toBe(1);

    const row = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(row.submissionReason).toBe("TIME_EXPIRED");
    expect(row.status).toBe("GRADED");

    const dup = await http("POST", `/api/attempts/${attemptId}/submit`, {
      cookie: studentCookie,
      body: { answers: [], submissionReason: "TIME_EXPIRED" },
    });
    expect(dup.status).toBe(200);
    expect((dup.json?.data as { score: number }).score).toBe(1);
  });

  it("rejects draft save after expiry", async () => {
    const fx = await createPublishedQuiz(teacher.id, chapterId, teacherCookie, 3);
    const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: studentCookie });
    const { attemptId } = start.json?.data as { attemptId: string };
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const save = await http("PATCH", `/api/attempts/${attemptId}/answers`, {
      cookie: studentCookie,
      body: { answers: [{ questionId: fx.mcqId, answer: "أ" }] },
    });
    expect(save.status).toBe(409);
  });

  it("lazy-finalizes expired in-progress attempt on GET results", async () => {
    const fx = await createPublishedQuiz(teacher.id, chapterId, teacherCookie, 4);
    const start = await http("POST", `/api/quizzes/${fx.quizId}/attempt`, { cookie: studentCookie });
    const { attemptId } = start.json?.data as { attemptId: string };

    await http("PATCH", `/api/attempts/${attemptId}/answers`, {
      cookie: studentCookie,
      body: { answers: [{ questionId: fx.tfId, answer: "صح" }] },
    });

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const results = await http("GET", `/api/attempts/${attemptId}`, { cookie: studentCookie });
    expect(results.status).toBe(200);
    expect((results.json?.data as { status: string }).status).toBe("GRADED");
    const row = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(row.submissionReason).toBe("TIME_EXPIRED");
  });
});
