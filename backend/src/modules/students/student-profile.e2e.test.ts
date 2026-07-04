import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Real HTTP/PostgreSQL E2E for GET /api/students/me/profile — the authenticated
 * student profile overview. Covers auth/role guards, the "own data only" rule,
 * and every derived section (identity, academic progress, courses,
 * subscriptions, achievements).
 */

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
  quizIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
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
  return { status: res.status, json };
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

function nextMobile(): string {
  mobileSeq += 1;
  return `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
}

async function createTeacher(fullName: string) {
  const id = randomUUID();
  const email = `sprof-t-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: { id, email, fullName, mobile: nextMobile(), password: pwHash, role: "OPERATION", status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createStudent(fullName: string, stageId: string) {
  const id = randomUUID();
  const email = `sprof-s-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName,
      mobile: nextMobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
      studentProfile: { create: { stageId } },
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createStage(teacherId: string) {
  const id = randomUUID();
  await prisma.stage.create({ data: { id, name: `sprof-stage-${id.slice(0, 8)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(id);
  return id;
}

async function createChapter(stageId: string, price: number | null, sortOrder: number) {
  const id = randomUUID();
  await prisma.chapter.create({
    data: { id, name: `sprof-ch-${id.slice(0, 8)}`, sortOrder, stageId, price },
  });
  owned.chapterIds.push(id);
  return id;
}

async function createLesson(chapterId: string, sortOrder: number) {
  const id = randomUUID();
  await prisma.lesson.create({ data: { id, title: "Lesson", durationMinutes: 10, sortOrder, chapterId } });
  owned.lessonIds.push(id);
  return id;
}

async function createQuiz(chapterId: string, teacherId: string) {
  const id = randomUUID();
  await prisma.quiz.create({
    data: { id, title: "Quiz", status: "PUBLISHED", chapterId, createdBy: teacherId, questionCount: 1, totalPoints: 10 },
  });
  owned.quizIds.push(id);
  return id;
}

async function enroll(
  studentId: string,
  chapterId: string,
  paymentMethod: "FREE" | "PROMO" | "PAYMOB",
  price: number,
) {
  await prisma.enrollment.create({ data: { studentId, chapterId, price, paymentMethod, status: "ACTIVE" } });
}

async function complete(studentId: string, lessonId: string) {
  await prisma.lessonProgress.create({ data: { studentId, lessonId, completed: true } });
}

async function attempt(studentId: string, quizId: string, score: number) {
  await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      answers: [] as unknown as Prisma.InputJsonValue,
      score,
      totalPoints: 10,
      status: "GRADED",
      completedAt: new Date(),
    },
  });
}

let teacherCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentA: { id: string; email: string };
let studentB: { id: string; email: string };
const STUDENT_A_NAME = "طالب كيمياء اختبار";

function overview(res: HttpResult) {
  return res.json!.data as {
    student: Record<string, unknown>;
    academicProgress: Record<string, unknown>;
    courses: Array<Record<string, unknown>>;
    subscriptions: Array<Record<string, unknown>>;
    achievements: Array<{ id: string; unlocked: boolean; unlockedAt: string | null }>;
  };
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const teacher = await createTeacher("Teacher Profile E2E");
  const stageId = await createStage(teacher.id);
  const freeChapter = await createChapter(stageId, null, 1); // free
  const paidChapter = await createChapter(stageId, 150, 2); // paid

  // free chapter: 2 lessons, paid chapter: 3 lessons → 5 accessible for A.
  const [l1, l2] = [await createLesson(freeChapter, 1), await createLesson(freeChapter, 2)];
  const [l3] = [await createLesson(paidChapter, 1), await createLesson(paidChapter, 2), await createLesson(paidChapter, 3)];
  const quiz = await createQuiz(paidChapter, teacher.id);

  studentA = await createStudent(STUDENT_A_NAME, stageId);
  studentB = await createStudent("Student B E2E", stageId);

  // Student A: enrolled in both chapters, 3 completed lessons, one perfect quiz.
  await enroll(studentA.id, freeChapter, "FREE", 0);
  await enroll(studentA.id, paidChapter, "PAYMOB", 150);
  await complete(studentA.id, l1!);
  await complete(studentA.id, l2!);
  await complete(studentA.id, l3!);
  await attempt(studentA.id, quiz, 10); // 100%

  // Student B: no enrollment, no progress. Only the free chapter is accessible.

  teacherCookie = await login(teacher.email);
  studentACookie = await login(studentA.email);
  studentBCookie = await login(studentB.email);
});

afterAll(async () => {
  await prisma.quizAttempt.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.lessonProgress.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.quiz.deleteMany({ where: { id: { in: owned.quizIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  server.close();
  await prisma.$disconnect();
});

describe("GET /api/students/me/profile", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await http("GET", "/api/students/me/profile");
    expect(res.status).toBe(401);
  });

  it("rejects a non-STUDENT (teacher) with 403", async () => {
    const res = await http("GET", "/api/students/me/profile", teacherCookie);
    expect(res.status).toBe(403);
  });

  it("returns the authenticated student's own identity from the User record", async () => {
    const res = await http("GET", "/api/students/me/profile", studentACookie);
    expect(res.status).toBe(200);
    const { student } = overview(res);
    expect(student.id).toBe(studentA.id);
    expect(student.fullName).toBe(STUDENT_A_NAME);
    expect(student.email).toBe(studentA.email);
    expect(student.role).toBe("STUDENT");
    expect(student.status).toBe("ACTIVE");
    expect(student.avatarInitial).toBe(Array.from(STUDENT_A_NAME)[0]);
    expect(typeof student.phone).toBe("string");
    expect(student.stageName).toEqual(expect.any(String));
  });

  it("ignores a studentId supplied in the query and returns the caller's own data", async () => {
    const res = await http(
      "GET",
      `/api/students/me/profile?studentId=${studentB.id}`,
      studentACookie,
    );
    expect(res.status).toBe(200);
    expect(overview(res).student.id).toBe(studentA.id);
  });

  it("derives academic progress from LessonProgress and QuizAttempt", async () => {
    const res = await http("GET", "/api/students/me/profile", studentACookie);
    const { academicProgress } = overview(res);
    expect(academicProgress.totalLessons).toBe(5); // 2 free + 3 paid, all accessible
    expect(academicProgress.completedLessons).toBe(3);
    expect(academicProgress.overallProgressPercent).toBe(60); // round(3/5*100)
    expect(academicProgress.completedQuizzes).toBe(1);
    expect(academicProgress.averageGrade).toBe(100);
  });

  it("derives courses (ACTIVE enrollments) and subscription history from Enrollment", async () => {
    const res = await http("GET", "/api/students/me/profile", studentACookie);
    const { courses, subscriptions } = overview(res);
    expect(courses).toHaveLength(2);
    expect(subscriptions).toHaveLength(2);
    const paymentMethods = subscriptions.map((s) => s.planType).sort();
    expect(paymentMethods).toEqual(["FREE", "PAYMOB"].sort());
    const paidCourse = courses.find((c) => c.planType === "PAYMOB")!;
    expect(paidCourse.totalLessons).toBe(3);
    expect(paidCourse.completedLessons).toBe(1);
    expect(paidCourse.progressPercent).toBe(33); // round(1/3*100)
  });

  it("derives achievements dynamically from progress/quiz data", async () => {
    const res = await http("GET", "/api/students/me/profile", studentACookie);
    const byId = Object.fromEntries(overview(res).achievements.map((a) => [a.id, a]));
    expect(byId.first_lesson!.unlocked).toBe(true);
    expect(byId.first_quiz!.unlocked).toBe(true);
    expect(byId.perfect_score!.unlocked).toBe(true);
    expect(byId.ten_lessons!.unlocked).toBe(false);
    expect(byId.twenty_five_lessons!.unlocked).toBe(false);
    expect(byId.first_lesson!.unlockedAt).toEqual(expect.any(String));
  });

  it("does not leak another student's data — Student B sees only their own empty profile", async () => {
    const res = await http("GET", "/api/students/me/profile", studentBCookie);
    expect(res.status).toBe(200);
    const data = overview(res);
    expect(data.student.id).toBe(studentB.id);
    expect(data.academicProgress.completedLessons).toBe(0);
    expect(data.academicProgress.totalLessons).toBe(2); // only the free chapter is accessible
    expect(data.academicProgress.averageGrade).toBeNull();
    expect(data.academicProgress.overallProgressPercent).toBe(0);
    expect(data.courses).toHaveLength(0);
    expect(data.subscriptions).toHaveLength(0);
    expect(data.achievements.every((a) => !a.unlocked)).toBe(true);
  });
});
