import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

/** Essay grading hub, submissions, detail, and grade-essays E2E. */

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
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
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
  const text = await res.text();
  let json: HttpResult["json"] = null;
  try {
    json = JSON.parse(text) as HttpResult["json"];
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
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
  const email = `essay-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName,
      mobile,
      password: pwHash,
      role,
      status: "ACTIVE",
      // Teachers must be APPROVED to pass requireActiveTeacherSubscription.
      teacherApprovalState: role === "OPERATION" ? "APPROVED" : "NONE",
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

const MCQ = randomUUID();
const ESSAY1 = randomUUID();
const ESSAY2 = randomUUID();

let teacher1: { id: string; email: string };
let teacher2: { id: string; email: string };
let student1: { id: string; email: string };
let quizId: string;
let foreignQuizId: string;
let pendingAttemptId: string;
let gradedAttemptId: string;
let t1Cookie: string;
let t2Cookie: string;
let s1Cookie: string;

function answers(essay: "pending" | "partial" | "graded"): Prisma.InputJsonValue {
  const e1 =
    essay === "graded"
      ? { result: "graded", awardedPoints: 4, feedback: "جيد" }
      : essay === "partial"
        ? { result: "graded", awardedPoints: 2, feedback: "مقبول" }
        : { result: "pending", awardedPoints: null, feedback: null };
  const e2 =
    essay === "graded"
      ? { result: "graded", awardedPoints: 3, feedback: "ممتاز" }
      : { result: "pending", awardedPoints: null, feedback: null };

  return [
    {
      questionId: MCQ,
      type: "MCQ",
      answer: "القاهرة",
      result: "correct",
      awardedPoints: 2,
      maxPoints: 2,
      feedback: null,
    },
    {
      questionId: ESSAY1,
      type: "ESSAY",
      answer: "إجابة مقالية طويلة من الطالب",
      maxPoints: 5,
      feedback: null,
      ...e1,
    },
    {
      questionId: ESSAY2,
      type: "ESSAY",
      answer: "إجابة ثانية",
      maxPoints: 5,
      feedback: null,
      ...e2,
    },
  ] as unknown as Prisma.InputJsonValue;
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  teacher1 = await createUser("OPERATION", "Teacher One");
  teacher2 = await createUser("OPERATION", "Teacher Two");
  student1 = await createUser("STUDENT", "أحمد الطالب");

  const stageId = randomUUID();
  await prisma.stage.create({
    data: { id: stageId, name: "ثالثة ثانوي", sortOrder: 1, teacherId: teacher1.id },
  });
  owned.stageIds.push(stageId);

  const chapterId = randomUUID();
  await prisma.chapter.create({
    data: { id: chapterId, name: "الكيمياء العضوية", sortOrder: 1, stageId },
  });
  owned.chapterIds.push(chapterId);

  quizId = randomUUID();
  await prisma.quiz.create({
    data: {
      id: quizId,
      title: "اختبار المقالات",
      chapterId,
      status: "PUBLISHED",
      createdBy: teacher1.id,
      questionCount: 3,
      totalPoints: 12,
    },
  });
  owned.quizIds.push(quizId);

  foreignQuizId = randomUUID();
  await prisma.quiz.create({
    data: {
      id: foreignQuizId,
      title: "اختبار أجنبي",
      chapterId,
      status: "PUBLISHED",
      createdBy: teacher2.id,
      questionCount: 1,
      totalPoints: 5,
    },
  });
  owned.quizIds.push(foreignQuizId);

  await prisma.question.createMany({
    data: [
      {
        id: MCQ,
        quizId,
        type: "MCQ",
        text: "عاصمة مصر؟",
        options: ["القاهرة", "الإسكندرية"],
        correctAnswer: "القاهرة",
        points: 2,
        sortOrder: 1,
      },
      {
        id: ESSAY1,
        quizId,
        type: "ESSAY",
        text: "اشرح التحليل الكهربائي",
        options: [],
        correctAnswer: null,
        points: 5,
        sortOrder: 2,
      },
      {
        id: ESSAY2,
        quizId,
        type: "ESSAY",
        text: "ما الفرق بين التفاعلات الطاردة والماصة؟",
        options: [],
        correctAnswer: null,
        points: 5,
        sortOrder: 3,
      },
    ],
  });

  pendingAttemptId = randomUUID();
  await prisma.quizAttempt.create({
    data: {
      id: pendingAttemptId,
      quizId,
      studentId: student1.id,
      status: "COMPLETED",
      score: 2,
      totalPoints: 12,
      answers: answers("pending"),
      completedAt: new Date("2026-01-10T10:00:00Z"),
    },
  });
  owned.attemptIds.push(pendingAttemptId);

  gradedAttemptId = randomUUID();
  await prisma.quizAttempt.create({
    data: {
      id: gradedAttemptId,
      quizId,
      studentId: teacher1.id,
      status: "GRADED",
      score: 9,
      totalPoints: 12,
      answers: answers("graded"),
      completedAt: new Date("2026-01-09T10:00:00Z"),
    },
  });
  owned.attemptIds.push(gradedAttemptId);

  t1Cookie = await login(teacher1.email);
  t2Cookie = await login(teacher2.email);
  s1Cookie = await login(student1.email);
});

afterAll(async () => {
  await prisma.quizAttempt.deleteMany({ where: { id: { in: owned.attemptIds } } });
  await prisma.question.deleteMany({ where: { quizId: { in: owned.quizIds } } });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function data(json: HttpResult["json"]): Record<string, unknown> {
  return (json?.data ?? {}) as Record<string, unknown>;
}

describe("Essay grading read APIs", () => {
  it("hub returns owned quiz with counts", async () => {
    const res = await http("GET", "/api/quizzes/essay-grading", { cookie: t1Cookie });
    expect(res.status).toBe(200);
    const rows = data(res.json).data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((r) => r.quizId === quizId)!;
    expect(row.quizTitle).toBe("اختبار المقالات");
    expect(row.chapterTitle).toBe("الكيمياء العضوية");
    expect(row.essayQuestionCount).toBe(2);
    expect(row.studentSubmissionCount).toBe(2);
    expect(row.pendingCount).toBe(1);
    expect(row.gradedCount).toBe(1);
  });

  it("hub excludes another teacher quiz", async () => {
    const res = await http("GET", "/api/quizzes/essay-grading", { cookie: t2Cookie });
    expect(res.status).toBe(200);
    const rows = (data(res.json).data ?? []) as { quizId: string }[];
    expect(rows.some((r) => r.quizId === quizId)).toBe(false);
  });

  it("hub rejects STUDENT", async () => {
    const res = await http("GET", "/api/quizzes/essay-grading", { cookie: s1Cookie });
    expect(res.status).toBe(403);
  });

  it("submissions list returns students without answer text", async () => {
    const res = await http("GET", `/api/quizzes/${quizId}/essay-submissions`, {
      cookie: t1Cookie,
    });
    expect(res.status).toBe(200);
    const payload = data(res.json).data as Record<string, unknown>;
    const subs = payload.submissions as Record<string, unknown>[];
    expect(subs.length).toBe(2);
    expect(subs.find((s) => s.attemptId === pendingAttemptId)?.status).toBe("PENDING");
    expect(subs.find((s) => s.attemptId === gradedAttemptId)?.status).toBe("GRADED");
    expect(JSON.stringify(subs)).not.toContain("إجابة مقالية");
    const summary = payload.summary as Record<string, number>;
    expect(summary.totalStudents).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.gradedCount).toBe(1);
  });

  it("other teacher cannot list submissions", async () => {
    const res = await http("GET", `/api/quizzes/${quizId}/essay-submissions`, {
      cookie: t2Cookie,
    });
    expect(res.status).toBe(403);
  });

  it("detail returns question and answer text for owning teacher", async () => {
    const res = await http("GET", `/api/attempts/${pendingAttemptId}/essay-grading`, {
      cookie: t1Cookie,
    });
    expect(res.status).toBe(200);
    const payload = data(res.json) as Record<string, unknown>;
    expect(payload.student).toMatchObject({ displayName: "أحمد الطالب" });
    const essays = payload.essayAnswers as Record<string, unknown>[];
    expect(essays).toHaveLength(2);
    expect(essays[0]?.questionText).toContain("التحليل");
    expect(essays[0]?.studentAnswer).toContain("إجابة مقالية");
    expect(essays[0]?.maximumPoints).toBe(5);
    expect(essays[0]?.awardedPoints).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("email");
    expect(JSON.stringify(payload)).not.toContain("mobile");
  });

  it("STUDENT cannot load grading detail", async () => {
    const res = await http("GET", `/api/attempts/${pendingAttemptId}/essay-grading`, {
      cookie: s1Cookie,
    });
    expect(res.status).toBe(403);
  });

  it("other teacher gets 404 on detail", async () => {
    const res = await http("GET", `/api/attempts/${pendingAttemptId}/essay-grading`, {
      cookie: t2Cookie,
    });
    expect(res.status).toBe(404);
  });
});

describe("Essay grading mutation", () => {
  it("grades all pending essays and recalculates score", async () => {
    const gradeAttemptId = randomUUID();
    const gradeStudent = await createUser("STUDENT", "طالب التصحيح");
    await prisma.quizAttempt.create({
      data: {
        id: gradeAttemptId,
        quizId,
        studentId: gradeStudent.id,
        status: "COMPLETED",
        score: 2,
        totalPoints: 12,
        answers: answers("pending"),
        completedAt: new Date("2026-01-11T10:00:00Z"),
      },
    });
    owned.attemptIds.push(gradeAttemptId);

    const res = await http("PATCH", `/api/attempts/${gradeAttemptId}/grade-essays`, {
      cookie: t1Cookie,
      body: {
        grades: [
          { questionId: ESSAY1, awardedPoints: 4, feedback: "جيد جداً" },
          { questionId: ESSAY2, awardedPoints: 0 },
        ],
      },
    });
    expect(res.status).toBe(200);
    const payload = data(res.json) as Record<string, unknown>;
    expect(payload.status).toBe("GRADED");
    expect(payload.score).toBe(6);
    expect(payload.pendingEssayCount).toBe(0);

    const detail = await http("GET", `/api/attempts/${gradeAttemptId}/essay-grading`, {
      cookie: t1Cookie,
    });
    const essays = (data(detail.json).essayAnswers ?? []) as { awardedPoints: number }[];
    expect(essays[1]?.awardedPoints).toBe(0);
  });

  it("rejects above-maximum marks", async () => {
    const badEssay = randomUUID();
    await prisma.question.create({
      data: {
        id: badEssay,
        quizId: foreignQuizId,
        type: "ESSAY",
        text: "سؤال",
        options: [],
        points: 5,
        sortOrder: 2,
      },
    });

    const attemptId = randomUUID();
    const badStudent = await createUser("STUDENT", "طالب اختبار");
    await prisma.quizAttempt.create({
      data: {
        id: attemptId,
        quizId: foreignQuizId,
        studentId: badStudent.id,
        status: "COMPLETED",
        score: 0,
        totalPoints: 5,
        answers: [
          {
            questionId: badEssay,
            type: "ESSAY",
            answer: "x",
            result: "pending",
            awardedPoints: null,
            maxPoints: 5,
            feedback: null,
          },
        ] as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    owned.attemptIds.push(attemptId);

    const res = await http("PATCH", `/api/attempts/${attemptId}/grade-essays`, {
      cookie: t2Cookie,
      body: { grades: [{ questionId: badEssay, awardedPoints: 99 }] },
    });
    expect(res.status).toBe(400);
  });

  it("STUDENT cannot grade", async () => {
    const res = await http("PATCH", `/api/attempts/${gradedAttemptId}/grade-essays`, {
      cookie: s1Cookie,
      body: { grades: [{ questionId: ESSAY1, awardedPoints: 1 }] },
    });
    expect(res.status).toBe(403);
  });
});
