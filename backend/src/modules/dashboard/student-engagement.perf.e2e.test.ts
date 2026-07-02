import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * STORY-66 — performance verification with 120 enrolled students against real
 * PostgreSQL. Asserts the endpoint stays under the 1s target. Honest, local
 * wall-clock measurement (not a production SLA claim).
 */

const PW = "PerfPass@123";
const DAY = 24 * 60 * 60 * 1000;
const STUDENT_COUNT = 120;
let server: Server;
let base: string;
let teacherCookie: string;
const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
  quizIds: [] as string[],
};

async function login(email: string): Promise<string> {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  const sc = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = sc.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed: ${res.status}`);
  return cookie;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

beforeAll(async () => {
  const pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const now = Date.now();

  const teacherId = randomUUID();
  owned.userIds.push(teacherId);
  await prisma.user.create({ data: { id: teacherId, email: `perf-t-${teacherId.slice(0, 8)}@e2e.test`, fullName: "Perf Teacher", mobile: `019${String(now % 100000000).padStart(8, "0")}`, password: pwHash, role: "OPERATION", status: "ACTIVE" } });

  const stageId = randomUUID(); owned.stageIds.push(stageId);
  await prisma.stage.create({ data: { id: stageId, name: "Perf Stage", sortOrder: 1, teacherId } });
  const chapterIds: string[] = [];
  for (let i = 0; i < 3; i++) { const id = randomUUID(); chapterIds.push(id); owned.chapterIds.push(id); await prisma.chapter.create({ data: { id, name: `C${i}`, sortOrder: i, stageId } }); }
  const lessonIds: string[] = [];
  for (let i = 0; i < 5; i++) { const id = randomUUID(); lessonIds.push(id); owned.lessonIds.push(id); await prisma.lesson.create({ data: { id, title: `L${i}`, durationMinutes: 10, sortOrder: i, chapterId: chapterIds[i % 3]! } }); }
  const quizIds: string[] = [];
  for (let i = 0; i < 3; i++) { const id = randomUUID(); quizIds.push(id); owned.quizIds.push(id); await prisma.quiz.create({ data: { id, title: `Q${i}`, status: "PUBLISHED", chapterId: chapterIds[i]!, createdBy: teacherId, questionCount: 1, totalPoints: 10 } }); }

  // Bulk users + related rows via createMany (fast, realistic joins).
  const users: Prisma.UserCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const progresses: Prisma.LessonProgressCreateManyInput[] = [];
  const attempts: Prisma.QuizAttemptCreateManyInput[] = [];
  const tokens: Prisma.RefreshTokenCreateManyInput[] = [];

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const id = randomUUID();
    owned.userIds.push(id);
    users.push({ id, email: `perf-s-${id.slice(0, 8)}@e2e.test`, fullName: `Perf Student ${String(i).padStart(3, "0")}`, mobile: `010${String((now + i) % 100000000).padStart(8, "0")}`, password: pwHash, role: "STUDENT", status: "ACTIVE" });
    // 1–2 enrollments (some multi-chapter), varied recency.
    enrollments.push({ studentId: id, chapterId: chapterIds[0]!, price: 0, paymentMethod: "FREE", status: "ACTIVE", enrolledAt: new Date(now - (i % 60) * DAY) });
    if (i % 3 === 0) enrollments.push({ studentId: id, chapterId: chapterIds[1]!, price: 0, paymentMethod: "FREE", status: "ACTIVE", enrolledAt: new Date(now - (i % 20) * DAY) });
    // ~85% have lesson progress + graded attempt + login; ~15% null activity.
    if (i % 7 !== 0) {
      progresses.push({ studentId: id, lessonId: lessonIds[i % 5]!, completed: true, updatedAt: new Date(now - (i % 10) * DAY) });
      progresses.push({ studentId: id, lessonId: lessonIds[(i + 1) % 5]!, completed: i % 2 === 0, updatedAt: new Date(now - (i % 8) * DAY) });
      attempts.push({ quizId: quizIds[i % 3]!, studentId: id, answers: [] as unknown as Prisma.InputJsonValue, score: (i % 11), totalPoints: 10, status: "GRADED", completedAt: new Date(now - (i % 5) * DAY), updatedAt: new Date(now - (i % 5) * DAY) });
      tokens.push({ token: randomUUID(), userId: id, createdAt: new Date(now - (i % 15) * DAY), expiresAt: new Date(now + 7 * DAY) });
    }
  }
  await prisma.user.createMany({ data: users });
  await prisma.enrollment.createMany({ data: enrollments });
  await prisma.lessonProgress.createMany({ data: progresses });
  await prisma.quizAttempt.createMany({ data: attempts });
  await prisma.refreshToken.createMany({ data: tokens });

  const teacher = await prisma.user.findUniqueOrThrow({ where: { id: teacherId }, select: { email: true } });
  teacherCookie = await login(teacher.email);
}, 60_000);

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

describe("STORY-66 performance (120 students)", () => {
  it("serves page 1 in under 1s (median of repeated runs)", async () => {
    const path = "/api/dashboard/teacher/students?page=1&sortBy=lastActivity&sortOrder=desc";
    // Warm-up (plan cache + connection).
    const warm = await fetch(`${base}${path}`, { headers: { Cookie: teacherCookie } });
    expect(warm.status).toBe(200);
    const warmJson = (await warm.json()) as { data: { pagination: { total: number } } };
    expect(warmJson.data.pagination.total).toBeGreaterThanOrEqual(100);

    const timings: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      const r = await fetch(`${base}${path}`, { headers: { Cookie: teacherCookie } });
      timings.push(performance.now() - t0);
      expect(r.status).toBe(200);
    }
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    const med = median(timings);
    // eslint-disable-next-line no-console
    console.log(`[STORY-66 perf] students>=100 page=1 runs=7 min=${min.toFixed(1)}ms median=${med.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    expect(med).toBeLessThan(1000);
  }, 60_000);
});
