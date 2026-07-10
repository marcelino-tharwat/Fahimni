/**
 * Student quiz unlock-by-lesson-completion E2E contract tests.
 *
 * Verifies the unified quiz eligibility policy end-to-end:
 *  - My Quizzes lists ALL relevant quizzes (locked ones stay visible).
 *  - Each item carries canTake / isUnlocked / lockReasonCode / quizScope.
 *  - Lesson quizzes unlock only after their lesson is completed.
 *  - A quiz stays locked until the previous quiz in the chapter is completed.
 *  - The chapter-end quiz needs ALL lessons completed + previous quiz done.
 *  - The attempt-start endpoint enforces the same policy (no bypass).
 *  - Students never see quizzes from chapters they are not enrolled in.
 *
 * Data is seeded directly (PUBLISHED quizzes) so the flow under test is the
 * STUDENT unlock policy, independent of the teacher authoring/approval flow.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import { TF_OPTIONS, TF_TRUE } from "./quiz-generation.mapping.js";

const PW = "QuizUnlock@2026";
const P = "e2e-qunlock";

const EMAILS = {
  teacher: `${P}-teacher@e2e.test`,
  student: `${P}-student@e2e.test`, // enrolled, walks the full flow
  studentB: `${P}-student-b@e2e.test`, // all lessons done, prev quiz NOT done
  studentOut: `${P}-student-out@e2e.test`, // different stage, no enrollment
} as const;

const IDS = {
  stage: `${P}-stage`,
  stageOut: `${P}-stage-out`,
  chapter: `${P}-chapter`,
  paidChapter: `${P}-paid-chapter`,
  l1: `${P}-l1`,
  l2: `${P}-l2`,
  l3: `${P}-l3`,
  qL1: `${P}-quiz-l1`,
  qL2: `${P}-quiz-l2`,
  qCh: `${P}-quiz-ch`,
  qPaid: `${P}-quiz-paid`,
};

let server: Server;
let base: string;
let studentId = "";
let studentBId = "";

interface HttpResult {
  status: number;
  json: {
    success?: boolean;
    message?: string;
    code?: string;
    lockReasonCode?: string;
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
    body: { email, password: PW },
  });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

interface ListedQuiz {
  id: string;
  quizScope: "LESSON" | "CHAPTER";
  isUnlocked: boolean;
  canTake: boolean;
  lockReason: string | null;
  lockReasonCode: string | null;
  order: number;
  previousQuizId: string | null;
  previousQuizCompleted: boolean;
  attemptState: { hasAttempt: boolean; latestStatus: string | null };
}

/** Flatten My Quizzes into a quizId -> item map for the seeded chapter. */
async function myQuizzes(cookie: string): Promise<Map<string, ListedQuiz>> {
  const r = await http("GET", "/api/quizzes/student", { cookie });
  expect(r.status).toBe(200);
  const payload = r.json?.data as {
    chapters: Array<{ id: string; quizzes: ListedQuiz[] }>;
  };
  const map = new Map<string, ListedQuiz>();
  for (const ch of payload.chapters) {
    for (const q of ch.quizzes) map.set(q.id, q);
  }
  return map;
}

async function completeLesson(cookie: string, lessonId: string): Promise<number> {
  const r = await http(
    "POST",
    `/api/content/student/lessons/${lessonId}/complete`,
    { cookie },
  );
  return r.status;
}

async function passQuiz(cookie: string, quizId: string): Promise<number> {
  const start = await http("POST", `/api/quizzes/${quizId}/attempt`, { cookie });
  if (start.status !== 201) return start.status;
  const data = start.json?.data as {
    attemptId: string;
    questions: Array<{ id: string }>;
  };
  const answers = data.questions.map((q) => ({
    questionId: q.id,
    answer: TF_TRUE,
  }));
  const submit = await http("POST", `/api/attempts/${data.attemptId}/submit`, {
    cookie,
    body: { answers, submissionReason: "MANUAL" },
  });
  return submit.status;
}

async function seedStudent(email: string, stageId: string): Promise<string> {
  const pwHash = await bcrypt.hash(PW, 12);
  let seq = 0;
  const mobile = () =>
    `0106${String((Date.now() + seq++) % 10_000_000).padStart(7, "0")}`;
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: email,
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, stageId },
    update: { stageId },
  });
  return u.id;
}

async function seedPublishedQuiz(
  id: string,
  title: string,
  contentScope: "CHAPTER" | "SELECTED_LESSONS",
  chapterId: string,
  teacherId: string,
  lessonIds: string[],
): Promise<void> {
  await prisma.quizLesson.deleteMany({ where: { quizId: id } });
  await prisma.question.deleteMany({ where: { quizId: id } });
  await prisma.quiz.upsert({
    where: { id },
    create: {
      id,
      title,
      chapterId,
      status: "PUBLISHED",
      contentScope,
      questionCount: 1,
      totalPoints: 1,
      durationMinutes: 15,
      passingScore: 50,
      createdBy: teacherId,
      publishedAt: new Date(),
    },
    update: {
      chapterId,
      status: "PUBLISHED",
      contentScope,
      durationMinutes: 15,
      passingScore: 50,
    },
  });
  await prisma.question.create({
    data: {
      quizId: id,
      type: "TRUE_FALSE",
      text: `${title} question`,
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
      points: 1,
      sortOrder: 1,
    },
  });
  for (const lessonId of lessonIds) {
    await prisma.quizLesson.create({ data: { quizId: id, lessonId } });
  }
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const pwHash = await bcrypt.hash(PW, 12);
  let seq = 0;
  const mobile = () =>
    `0107${String((Date.now() + seq++) % 10_000_000).padStart(7, "0")}`;

  const teacher = await prisma.user.upsert({
    where: { email: EMAILS.teacher },
    create: {
      email: EMAILS.teacher,
      fullName: "QUnlock Teacher",
      mobile: mobile(),
      password: pwHash,
      role: "OPERATION",
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
    },
    update: { status: "ACTIVE", teacherApprovalState: "APPROVED" },
  });

  await prisma.stage.upsert({
    where: { id: IDS.stage },
    create: { id: IDS.stage, name: "QUnlock Stage", sortOrder: 7001, teacherId: teacher.id },
    update: { teacherId: teacher.id, deletedAt: null },
  });
  await prisma.stage.upsert({
    where: { id: IDS.stageOut },
    create: { id: IDS.stageOut, name: "QUnlock Stage Out", sortOrder: 7002, teacherId: teacher.id },
    update: { teacherId: teacher.id, deletedAt: null },
  });

  await prisma.chapter.upsert({
    where: { id: IDS.chapter },
    create: { id: IDS.chapter, name: "QUnlock Chapter", sortOrder: 1, stageId: IDS.stage, price: 0 },
    update: { deletedAt: null, stageId: IDS.stage, price: 0 },
  });
  // A PAID chapter in the SAME stage that the student is NOT enrolled in.
  await prisma.chapter.upsert({
    where: { id: IDS.paidChapter },
    create: { id: IDS.paidChapter, name: "QUnlock Paid Chapter", sortOrder: 2, stageId: IDS.stage, price: 100 },
    update: { deletedAt: null, stageId: IDS.stage, price: 100 },
  });

  const lessonDefs = [
    { id: IDS.l1, sortOrder: 1 },
    { id: IDS.l2, sortOrder: 2 },
    { id: IDS.l3, sortOrder: 3 },
  ];
  for (const l of lessonDefs) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      create: {
        id: l.id,
        title: `Lesson ${l.sortOrder}`,
        sortOrder: l.sortOrder,
        durationMinutes: 10,
        chapterId: IDS.chapter,
      },
      update: { chapterId: IDS.chapter, deletedAt: null, requiredQuizId: null },
    });
  }

  await seedPublishedQuiz(IDS.qL1, "Lesson 1 Quiz", "SELECTED_LESSONS", IDS.chapter, teacher.id, [IDS.l1]);
  await seedPublishedQuiz(IDS.qL2, "Lesson 2 Quiz", "SELECTED_LESSONS", IDS.chapter, teacher.id, [IDS.l2]);
  await seedPublishedQuiz(IDS.qCh, "Chapter Final Quiz", "CHAPTER", IDS.chapter, teacher.id, []);
  await seedPublishedQuiz(IDS.qPaid, "Paid Chapter Quiz", "CHAPTER", IDS.paidChapter, teacher.id, []);

  studentId = await seedStudent(EMAILS.student, IDS.stage);
  studentBId = await seedStudent(EMAILS.studentB, IDS.stage);
  await seedStudent(EMAILS.studentOut, IDS.stageOut);

  // Enroll the two in-flow students in the (free) chapter. The submit path
  // requires an ACTIVE enrollment row even for free chapters.
  for (const sId of [studentId, studentBId]) {
    await prisma.enrollment.upsert({
      where: { studentId_chapterId: { studentId: sId, chapterId: IDS.chapter } },
      create: {
        studentId: sId,
        chapterId: IDS.chapter,
        status: "ACTIVE",
        price: 0,
        paymentMethod: "FREE",
      },
      update: { status: "ACTIVE" },
    });
  }

  // Clean per-student mutable state for determinism.
  await prisma.lessonProgress.deleteMany({
    where: { studentId: { in: [studentId, studentBId] } },
  });
  await prisma.quizAttempt.deleteMany({
    where: {
      studentId: { in: [studentId, studentBId] },
      quizId: { in: [IDS.qL1, IDS.qL2, IDS.qCh] },
    },
  });

  // studentB: mark ALL lessons completed but take NO quizzes (prev-quiz gate).
  for (const lessonId of [IDS.l1, IDS.l2, IDS.l3]) {
    await prisma.lessonProgress.create({
      data: { studentId: studentBId, lessonId, completed: true },
    });
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("Student quiz unlock by lesson completion", () => {
  it("1-2. My Quizzes lists all quizzes with eligibility fields (locked visible)", async () => {
    const cookie = await login(EMAILS.student);
    const q = await myQuizzes(cookie);

    // All three seeded quizzes are present.
    expect(q.has(IDS.qL1)).toBe(true);
    expect(q.has(IDS.qL2)).toBe(true);
    expect(q.has(IDS.qCh)).toBe(true);

    // Eligibility fields exist and are typed.
    const l1 = q.get(IDS.qL1)!;
    expect(l1.quizScope).toBe("LESSON");
    expect(typeof l1.isUnlocked).toBe("boolean");
    expect(typeof l1.canTake).toBe("boolean");
    expect(q.get(IDS.qCh)!.quizScope).toBe("CHAPTER");

    // Ordering: lesson quizzes first, chapter quiz last.
    expect(l1.order).toBeLessThan(q.get(IDS.qL2)!.order);
    expect(q.get(IDS.qL2)!.order).toBeLessThan(q.get(IDS.qCh)!.order);
  });

  it("3. lesson quiz is LOCKED before its lesson is completed", async () => {
    const cookie = await login(EMAILS.student);
    const q = await myQuizzes(cookie);
    const l1 = q.get(IDS.qL1)!;
    expect(l1.isUnlocked).toBe(false);
    expect(l1.canTake).toBe(false);
    expect(l1.lockReasonCode).toBe("LESSON_NOT_COMPLETED");
    expect(l1.lockReason).toBe("أكمل مشاهدة الدرس أولًا");
  });

  it("7-8. chapter quiz is chapter-scoped and locked until all lessons done", async () => {
    const cookie = await login(EMAILS.student);
    const q = await myQuizzes(cookie);
    const ch = q.get(IDS.qCh)!;
    expect(ch.quizScope).toBe("CHAPTER");
    expect(ch.isUnlocked).toBe(false);
    expect(ch.lockReasonCode).toBe("CHAPTER_LESSONS_NOT_COMPLETED");
  });

  it("11. attempt-start blocks a locked lesson quiz (no bypass)", async () => {
    const cookie = await login(EMAILS.student);
    const r = await http("POST", `/api/quizzes/${IDS.qL1}/attempt`, { cookie });
    expect(r.status).toBe(403);
    expect(r.json?.code).toBe("QUIZ_LOCKED");
    expect(r.json?.lockReasonCode).toBe("LESSON_NOT_COMPLETED");
  });

  it("4. lesson quiz unlocks after completing the lesson (complete API)", async () => {
    const cookie = await login(EMAILS.student);
    expect(await completeLesson(cookie, IDS.l1)).toBe(200);

    const q = await myQuizzes(cookie);
    const l1 = q.get(IDS.qL1)!;
    expect(l1.isUnlocked).toBe(true);
    expect(l1.canTake).toBe(true);
    expect(l1.lockReasonCode).toBeNull();

    // The attempt endpoint now allows it.
    const start = await http("POST", `/api/quizzes/${IDS.qL1}/attempt`, { cookie });
    expect(start.status).toBe(201);
  });

  it("5. second lesson quiz stays locked before the previous quiz is completed", async () => {
    const cookie = await login(EMAILS.student);
    // L1 is completed; complete L2 as well so ONLY the previous-quiz gate remains.
    expect(await completeLesson(cookie, IDS.l2)).toBe(200);

    const q = await myQuizzes(cookie);
    const l2 = q.get(IDS.qL2)!;
    // Q_L1 has an in-progress attempt from the previous test → not "completed".
    expect(l2.previousQuizId).toBe(IDS.qL1);
    expect(l2.previousQuizCompleted).toBe(false);
    expect(l2.isUnlocked).toBe(false);
    expect(l2.lockReasonCode).toBe("PREVIOUS_QUIZ_NOT_COMPLETED");
  });

  it("12. attempt-start blocks a quiz whose previous quiz is incomplete", async () => {
    const cookie = await login(EMAILS.student);
    const r = await http("POST", `/api/quizzes/${IDS.qL2}/attempt`, { cookie });
    expect(r.status).toBe(403);
    expect(r.json?.code).toBe("QUIZ_LOCKED");
    expect(r.json?.lockReasonCode).toBe("PREVIOUS_QUIZ_NOT_COMPLETED");
  });

  it("6. second lesson quiz unlocks after previous quiz completed + lesson completed", async () => {
    const cookie = await login(EMAILS.student);
    // Complete Q_L1 (pass) → previous-quiz gate satisfied for Q_L2.
    expect(await passQuiz(cookie, IDS.qL1)).toBe(200);

    const q = await myQuizzes(cookie);
    const l2 = q.get(IDS.qL2)!;
    expect(l2.previousQuizCompleted).toBe(true);
    expect(l2.isUnlocked).toBe(true);
    expect(l2.canTake).toBe(true);
  });

  it("9. chapter quiz remains locked if a previous lesson quiz is incomplete", async () => {
    // studentB has ALL lessons completed but has taken NO quizzes.
    const cookie = await login(EMAILS.studentB);
    const q = await myQuizzes(cookie);
    const ch = q.get(IDS.qCh)!;
    expect(ch.isUnlocked).toBe(false);
    expect(ch.lockReasonCode).toBe("PREVIOUS_QUIZ_NOT_COMPLETED");
    expect(ch.previousQuizId).toBe(IDS.qL2);
  });

  it("13. attempt-start blocks the chapter quiz before all lessons completed", async () => {
    // Main student here has L1+L2 completed and Q_L1 passed, but L3 is still
    // incomplete → the chapter-end quiz must be blocked on the lessons gate.
    const cookie = await login(EMAILS.student);
    const r = await http("POST", `/api/quizzes/${IDS.qCh}/attempt`, { cookie });
    expect(r.status).toBe(403);
    expect(r.json?.code).toBe("QUIZ_LOCKED");
    expect(r.json?.lockReasonCode).toBe("CHAPTER_LESSONS_NOT_COMPLETED");
  });

  it("10 & 14. chapter quiz unlocks after all lessons + previous quizzes; start allowed", async () => {
    const cookie = await login(EMAILS.student);
    // main student: L1,L2 done, Q_L1 passed. Finish the flow.
    expect(await completeLesson(cookie, IDS.l3)).toBe(200);
    expect(await passQuiz(cookie, IDS.qL2)).toBe(200);

    const q = await myQuizzes(cookie);
    const ch = q.get(IDS.qCh)!;
    expect(ch.isUnlocked).toBe(true);
    expect(ch.canTake).toBe(true);
    expect(ch.lockReasonCode).toBeNull();

    const start = await http("POST", `/api/quizzes/${IDS.qCh}/attempt`, { cookie });
    expect(start.status).toBe(201);
  });

  it("15. manual URL attempt on a locked quiz cannot bypass the gate", async () => {
    // studentB: all lessons done, no quizzes taken → Q_CH locked by prev quiz.
    const cookie = await login(EMAILS.studentB);
    const r = await http("POST", `/api/quizzes/${IDS.qCh}/attempt`, { cookie });
    expect(r.status).toBe(403);
    expect(r.json?.code).toBe("QUIZ_LOCKED");
  });

  it("16. retake/view-result state is exposed via attemptState (existing policy)", async () => {
    const cookie = await login(EMAILS.student);
    const q = await myQuizzes(cookie);
    const l1 = q.get(IDS.qL1)!;
    // Q_L1 was passed → has a finished attempt, not retakeable, not takeable.
    expect(l1.attemptState.hasAttempt).toBe(true);
    expect(l1.attemptState.latestStatus).toBe("GRADED");
    expect(l1.canTake).toBe(false);
  });

  it("17. student cannot see quizzes from chapters without enrollment", async () => {
    const cookie = await login(EMAILS.student);
    const r = await http("GET", "/api/quizzes/student", { cookie });
    const payload = r.json?.data as {
      chapters: Array<{ id: string; quizzes: Array<{ id: string }> }>;
    };
    const allQuizIds = payload.chapters.flatMap((c) => c.quizzes.map((x) => x.id));
    // Paid chapter (not enrolled) quiz must be absent.
    expect(allQuizIds).not.toContain(IDS.qPaid);
    // A student in a different stage sees none of these chapter quizzes.
    const outCookie = await login(EMAILS.studentOut);
    const outList = await myQuizzes(outCookie);
    expect(outList.has(IDS.qL1)).toBe(false);
    expect(outList.has(IDS.qCh)).toBe(false);
  });
});
