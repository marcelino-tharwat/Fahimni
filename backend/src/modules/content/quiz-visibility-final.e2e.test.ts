/**
 * Final quiz visibility + progression E2E contract tests.
 * Requires isolated DB: fahimni_e2e_quiz_visibility (see scripts/provision-e2e-db.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import {
  E2E_QV_EMAILS,
  E2E_QV_PASSWORD,
  seedQuizVisibilityE2EFixture,
  type QuizVisibilityE2EFixture,
} from "../../test/fixtures/quiz-visibility-e2e.fixture.js";

let server: Server;
let base: string;
let fx: QuizVisibilityE2EFixture;
let t1Cookie: string;
let s1Cookie: string;
let s2Cookie: string;

interface HttpResult {
  status: number;
  json: {
    success?: boolean;
    message?: string;
    code?: string;
    data?: Record<string, unknown>;
  } | null;
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
    body: { email, password: E2E_QV_PASSWORD },
  });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

function treeLesson(
  tree: unknown,
  lessonId: string,
): { isUnlocked?: boolean; nextLessonId?: string | null; lockReason?: string | null } | undefined {
  for (const stage of tree as Array<{
    chapters: Array<{
      lessons: Array<{
        id: string;
        isUnlocked: boolean;
        nextLessonId: string | null;
        lockReason: string | null;
      }>;
    }>;
  }>) {
    for (const ch of stage.chapters) {
      const hit = ch.lessons.find((l) => l.id === lessonId);
      if (hit) return hit;
    }
  }
  return undefined;
}

async function submitQuizAttempt(
  cookie: string,
  quizId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  const start = await http("POST", `/api/quizzes/${quizId}/attempt`, { cookie });
  expect(start.status).toBe(201);
  const attemptId = (start.json?.data as { attemptId?: string })?.attemptId;
  expect(attemptId).toBeTruthy();
  const submit = await http("POST", `/api/attempts/${attemptId}/submit`, {
    cookie,
    body: {
      answers: [{ questionId, answer }],
      submissionReason: "MANUAL",
    },
  });
  expect(submit.status).toBe(200);
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  fx = await seedQuizVisibilityE2EFixture();
  t1Cookie = await login(E2E_QV_EMAILS.teacher1);
  s1Cookie = await login(E2E_QV_EMAILS.student1);
  s2Cookie = await login(E2E_QV_EMAILS.student2);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("A — optional lesson-linked quiz visibility", () => {
  it("shows Q1 in available on A1, not required; Q1 absent on A2", async () => {
    const a1 = await http("GET", `/api/content/student/lessons/${fx.lessonA1Id}`, {
      cookie: s1Cookie,
    });
    expect(a1.status).toBe(200);
    const quizzes = a1.json?.data?.quizzes as {
      available: Array<{ id: string }>;
      required: { id: string } | null;
    };
    expect(quizzes.available.some((q) => q.id === fx.quizQ1Id)).toBe(true);
    expect(quizzes.required).toBeNull();

    const a2 = await http("GET", `/api/content/student/lessons/${fx.lessonA2Id}`, {
      cookie: s1Cookie,
    });
    expect(a2.status).toBe(403);

    const chapterQuizzesA1 = await http(
      "GET",
      `/api/chapters/${fx.chapterAId}/quizzes?lessonId=${fx.lessonA1Id}`,
      { cookie: s1Cookie },
    );
    expect(chapterQuizzesA1.status).toBe(200);
    const listA1 = chapterQuizzesA1.json?.data as Array<{ id: string }>;
    expect(listA1.some((q) => q.id === fx.quizQ1Id)).toBe(true);
  });
});

describe("B — required quiz progression", () => {
  it("blocks A2 until Q2 passed after A1 completion", async () => {
    const treeBefore = await http("GET", "/api/content/student/tree", { cookie: s1Cookie });
    expect(treeLesson(treeBefore.json, fx.lessonA2Id)?.isUnlocked).toBe(false);

    const complete = await http(
      "POST",
      `/api/content/student/lessons/${fx.lessonA1Id}/complete`,
      { cookie: s1Cookie },
    );
    expect(complete.status).toBe(200);
    expect(complete.json?.data?.nextLessonId).toBeNull();
    const req = (complete.json?.data?.quizzes as { required?: { id: string } | null })?.required;
    expect(req?.id).toBe(fx.quizQ2Id);

    const treeMid = await http("GET", "/api/content/student/tree", { cookie: s1Cookie });
    expect(treeLesson(treeMid.json, fx.lessonA2Id)?.isUnlocked).toBe(false);

    await submitQuizAttempt(s1Cookie, fx.quizQ2Id, fx.q2QuestionId, fx.q2CorrectAnswer);

    const treeAfter = await http("GET", "/api/content/student/tree", { cookie: s1Cookie });
    expect(treeLesson(treeAfter.json, fx.lessonA2Id)?.isUnlocked).toBe(true);

    const a1Detail = await http("GET", `/api/content/student/lessons/${fx.lessonA1Id}`, {
      cookie: s1Cookie,
    });
    expect(a1Detail.json?.data?.nextLessonId).toBe(fx.lessonA2Id);
  });
});

describe("C — chapter-linked quiz", () => {
  it("lists Q3 for student without marking it required for A1", async () => {
    const list = await http("GET", "/api/quizzes/student", { cookie: s1Cookie });
    expect(list.status).toBe(200);
    const payload = list.json?.data as {
      chapters: Array<{ id: string; quizzes: Array<{ id: string }> }>;
    };
    const ch = payload.chapters.find((c) => c.id === fx.chapterAId);
    expect(ch?.quizzes.some((q) => q.id === fx.quizQ3Id)).toBe(true);

    const a1 = await http("GET", `/api/content/student/lessons/${fx.lessonA1Id}`, {
      cookie: s1Cookie,
    });
    const required = (a1.json?.data?.quizzes as { required?: { id: string } | null })?.required;
    expect(required?.id).toBe(fx.quizQ2Id);
    expect(required?.id).not.toBe(fx.quizQ3Id);
  });
});

describe("D — assign/publish preserves QuizLesson", () => {
  it("same-chapter assign on draft keeps SELECTED_LESSONS and QuizLesson", async () => {
    const draft = await prisma.quiz.create({
      data: {
        title: "E2E Draft Scope Quiz",
        chapterId: fx.chapterAId,
        status: "DRAFT",
        contentScope: "SELECTED_LESSONS",
        questionCount: 1,
        totalPoints: 1,
        durationMinutes: 10,
        createdBy: fx.teacher1Id,
        quizLessons: { create: { lessonId: fx.lessonA1Id } },
        questions: {
          create: {
            type: "TRUE_FALSE",
            text: "Draft Q",
            options: { A: "True", B: "False" },
            correctAnswer: "A",
            points: 1,
            sortOrder: 1,
          },
        },
      },
    });

    const assign = await http("POST", `/api/quizzes/${draft.id}/assign`, {
      cookie: t1Cookie,
      body: { chapterId: fx.chapterAId },
    });
    expect(assign.status).toBe(200);

    const pub = await http("PATCH", `/api/quizzes/${draft.id}/publish`, {
      cookie: t1Cookie,
      body: {},
    });
    expect(pub.status).toBe(200);

    const after = await http("GET", `/api/quizzes/${draft.id}`, { cookie: t1Cookie });
    const afterScope = after.json?.data as {
      contentScope: string;
      scope?: { lessons: Array<{ id: string }> };
    };
    expect(afterScope.contentScope).toBe("SELECTED_LESSONS");
    expect(afterScope.scope?.lessons.some((l) => l.id === fx.lessonA1Id)).toBe(true);

    await prisma.quiz.delete({ where: { id: draft.id } });
  });
});

describe("E — direct access enforcement", () => {
  it("denies locked A2 and Q2 start before A1 completion for S2", async () => {
    await prisma.lessonProgress.deleteMany({
      where: { studentId: fx.student2Id, lessonId: fx.lessonA1Id },
    });
    await prisma.quizAttempt.deleteMany({
      where: { studentId: fx.student2Id, quizId: fx.quizQ2Id },
    });

    const directA2 = await http("GET", `/api/content/student/lessons/${fx.lessonA2Id}`, {
      cookie: s2Cookie,
    });
    expect(directA2.status).toBe(403);

    const startQ2 = await http("POST", `/api/quizzes/${fx.quizQ2Id}/attempt`, {
      cookie: s2Cookie,
    });
    expect(startQ2.status).toBe(403);
    expect(startQ2.json?.code).toBe("QUIZ_PREREQUISITE_LESSON_INCOMPLETE");
  });
});

describe("F — failed required quiz", () => {
  it("keeps A2 locked after failing Q2", async () => {
    await prisma.lessonProgress.deleteMany({
      where: { studentId: fx.student1Id, lessonId: { in: [fx.lessonA1Id, fx.lessonA2Id] } },
    });
    await prisma.quizAttempt.deleteMany({
      where: { studentId: fx.student1Id, quizId: fx.quizQ2Id },
    });

    await http("POST", `/api/content/student/lessons/${fx.lessonA1Id}/complete`, {
      cookie: s1Cookie,
    });

    await submitQuizAttempt(s1Cookie, fx.quizQ2Id, fx.q2QuestionId, fx.q2WrongAnswer);

    const tree = await http("GET", "/api/content/student/tree", { cookie: s1Cookie });
    const a2 = treeLesson(tree.json, fx.lessonA2Id);
    expect(a2?.isUnlocked).toBe(false);
    expect(a2?.lockReason).toBe("REQUIRED_QUIZ_NOT_PASSED");
  });
});

describe("Auth — local login", () => {
  it("teacher and students authenticate", async () => {
    const meT = await http("GET", "/api/v1/auth/me", { cookie: t1Cookie });
    expect(meT.status).toBe(200);
    const meS = await http("GET", "/api/v1/auth/me", { cookie: s1Cookie });
    expect(meS.status).toBe(200);
  });
});
