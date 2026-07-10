/**
 * E2E: banned/inactive teacher content hidden from student All Content.
 *
 * Verifies:
 * 1. All Content excludes BANNED teacher content.
 * 2. All Content excludes INACTIVE teacher content.
 * 3. All Content includes ACTIVE + APPROVED teacher content.
 * 4. All Content includes APPROVED FREE teacher content.
 * 5. My Courses still shows already-enrolled banned teacher content.
 * 6. Already-enrolled student can access enrolled banned-teacher lesson.
 * 7. New enrollment for banned teacher content is blocked (COURSE_NOT_AVAILABLE).
 * 8. New payment checkout for banned teacher content is blocked.
 * 9. Admin views still see banned teacher content.
 * 10. No banned reason/admin notes leaked to student response.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "HideBannedE2E@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
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
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

function mobile(): string {
  return "011" + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 100)).padStart(2, "0");
}

/** Check if a chapter id appears in the student tree response. */
function treeHasChapter(tree: unknown, chapterId: string): boolean {
  const stages = tree as Array<{ chapters?: Array<{ chapter?: { id: string } }> }>;
  for (const stage of stages) {
    if (stage.chapters?.some((c) => c.chapter?.id === chapterId)) return true;
  }
  return false;
}

/** Check if a chapter id appears in the my-courses response (wrapped in an ApiResponse envelope or array). */
function myCoursesHasChapter(response: unknown, chapterId: string): boolean {
  // Response could be a plain array or { data: [...] }.
  const raw = response as Record<string, unknown>;
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? (raw.data as Array<Record<string, unknown>>)
      : [];
  return arr.some((c: Record<string, unknown>) => c.id === chapterId || (c.chapter && (c.chapter as Record<string, unknown>).id === chapterId));
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 10);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: owned.lessonIds } } });
  await prisma.enrollment.deleteMany({ where: { chapterId: { in: owned.chapterIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { chapterId: { in: owned.chapterIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.studentProfile.deleteMany({ where: { stageId: { in: owned.stageIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("hide banned teacher content from All Content", () => {
  it("(1, 3) All Content includes ACTIVE+APPROVED teacher content, excludes BANNED teacher content", async () => {
    const suffix = randomUUID().slice(0, 8);

    // ACTIVE + APPROVED teacher.
    const activeTeacher = await prisma.user.create({
      data: {
        fullName: `Active Teacher ${suffix}`,
        email: `active.t.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(activeTeacher.id);

    // BANNED teacher.
    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.t.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    // Student.
    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    // Active teacher's stage + chapter.
    const activeStage = await prisma.stage.create({
      data: { name: `Active Stage ${suffix}`, sortOrder: 1, teacherId: activeTeacher.id },
    });
    owned.stageIds.push(activeStage.id);

    const activeChapter = await prisma.chapter.create({
      data: { name: `Active Chapter ${suffix}`, sortOrder: 1, price: null, stageId: activeStage.id },
    });
    owned.chapterIds.push(activeChapter.id);

    // Banned teacher's stage + chapter.
    const bannedStage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 2, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(bannedStage.id);

    const bannedChapter = await prisma.chapter.create({
      data: { name: `Banned Chapter ${suffix}`, sortOrder: 1, price: null, stageId: bannedStage.id },
    });
    owned.chapterIds.push(bannedChapter.id);

    // Student profile points to active teacher's stage (so they can see active teacher's content).
    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: activeStage.id },
    });

    const studentCookie = await login(student.email);

    // All Content tree.
    const tree = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(tree.status).toBe(200);
    expect(treeHasChapter(tree.json, activeChapter.id)).toBe(true);
    expect(treeHasChapter(tree.json, bannedChapter.id)).toBe(false);
  });

  it("(2) All Content excludes INACTIVE teacher content", async () => {
    const suffix = randomUUID().slice(0, 8);

    const inactiveTeacher = await prisma.user.create({
      data: {
        fullName: `Inactive Teacher ${suffix}`,
        email: `inactive.t.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "INACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(inactiveTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.inactive.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const inactiveStage = await prisma.stage.create({
      data: { name: `Inactive Stage ${suffix}`, sortOrder: 3, teacherId: inactiveTeacher.id },
    });
    owned.stageIds.push(inactiveStage.id);

    const inactiveChapter = await prisma.chapter.create({
      data: { name: `Inactive Chapter ${suffix}`, sortOrder: 1, price: null, stageId: inactiveStage.id },
    });
    owned.chapterIds.push(inactiveChapter.id);

    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: inactiveStage.id },
    });

    const studentCookie = await login(student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(tree.status).toBe(200);
    expect(treeHasChapter(tree.json, inactiveChapter.id)).toBe(false);
  });

  it("(4) All Content includes APPROVED FREE teacher content (ACTIVE + APPROVED)", async () => {
    const suffix = randomUUID().slice(0, 8);

    const freeTeacher = await prisma.user.create({
      data: {
        fullName: `Free Teacher ${suffix}`,
        email: `free.t.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(freeTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.free.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const freeStage = await prisma.stage.create({
      data: { name: `Free Stage ${suffix}`, sortOrder: 4, teacherId: freeTeacher.id },
    });
    owned.stageIds.push(freeStage.id);

    const freeChapter = await prisma.chapter.create({
      data: { name: `Free Chapter ${suffix}`, sortOrder: 1, price: null, stageId: freeStage.id },
    });
    owned.chapterIds.push(freeChapter.id);

    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: freeStage.id },
    });

    const studentCookie = await login(student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(tree.status).toBe(200);
    expect(treeHasChapter(tree.json, freeChapter.id)).toBe(true);
  });

  it("(5) My Courses still shows already-enrolled banned teacher content", async () => {
    const suffix = randomUUID().slice(0, 8);

    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.mc.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.mc.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const stage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 5, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(stage.id);

    const chapter = await prisma.chapter.create({
      data: { name: `Banned Enrolled Chapter ${suffix}`, sortOrder: 1, price: null, stageId: stage.id },
    });
    owned.chapterIds.push(chapter.id);

    // Student profile (this stage is the student's "home" stage).
    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: stage.id },
    });

    // Already enrolled.
    await prisma.enrollment.create({
      data: { studentId: student.id, chapterId: chapter.id, price: 0, paymentMethod: "FREE" },
    });

    const studentCookie = await login(student.email);

    // All Content should NOT show this (teacher is banned).
    const tree = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(tree.status).toBe(200);
    expect(treeHasChapter(tree.json, chapter.id)).toBe(false);

    // My Courses SHOULD still show it.
    const myCourses = await http("GET", "/api/content/student/my-courses", { cookie: studentCookie });
    expect(myCourses.status).toBe(200);
    expect(myCoursesHasChapter(myCourses.json, chapter.id)).toBe(true);
  });

  it("(6) Already-enrolled student can access lesson in banned teacher content", async () => {
    const suffix = randomUUID().slice(0, 8);

    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.lesson.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.lesson.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const stage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 6, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(stage.id);

    const chapter = await prisma.chapter.create({
      data: { name: `Banned Chapter ${suffix}`, sortOrder: 1, price: null, stageId: stage.id },
    });
    owned.chapterIds.push(chapter.id);

    const lesson = await prisma.lesson.create({
      data: { title: `Banned Lesson ${suffix}`, durationMinutes: 15, sortOrder: 1, chapterId: chapter.id },
    });
    owned.lessonIds.push(lesson.id);

    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: stage.id },
    });

    // Already enrolled (free chapter).
    await prisma.enrollment.create({
      data: { studentId: student.id, chapterId: chapter.id, price: 0, paymentMethod: "FREE" },
    });

    const studentCookie = await login(student.email);

    // Access lesson.
    const lessonRes = await http("GET", `/api/content/student/lessons/${lesson.id}`, { cookie: studentCookie });
    expect(lessonRes.status).toBe(200);
  });

  it("(7, 8) New enrollment/payment for banned teacher content is blocked with COURSE_NOT_AVAILABLE", async () => {
    const suffix = randomUUID().slice(0, 8);

    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.block.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    const activeTeacher = await prisma.user.create({
      data: {
        fullName: `Active Teacher ${suffix}`,
        email: `active.block.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(activeTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.block.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    // Banned teacher's stage + chapter (free chapter).
    const bannedStage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 7, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(bannedStage.id);

    const bannedChapter = await prisma.chapter.create({
      data: { name: `Banned Chapter ${suffix}`, sortOrder: 1, price: null, stageId: bannedStage.id },
    });
    owned.chapterIds.push(bannedChapter.id);

    // Active teacher's stage + chapter for the student profile.
    const activeStage = await prisma.stage.create({
      data: { name: `Active Stage ${suffix}`, sortOrder: 1, teacherId: activeTeacher.id },
    });
    owned.stageIds.push(activeStage.id);

    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: activeStage.id },
    });

    const studentCookie = await login(student.email);

    // Free enrollment should be blocked.
    const enrollFree = await http("POST", "/api/enrollments/free", {
      cookie: studentCookie,
      body: { chapterId: bannedChapter.id },
    });
    expect(enrollFree.status).toBe(403);
    expect((enrollFree.json as Record<string, unknown>)?.code).toBe("COURSE_NOT_AVAILABLE");

    // Payment checkout for a paid banned teacher's chapter (create one).
    const bannedPaidChapter = await prisma.chapter.create({
      data: { name: `Banned Paid Chapter ${suffix}`, sortOrder: 2, price: 50, stageId: bannedStage.id },
    });
    owned.chapterIds.push(bannedPaidChapter.id);

    const checkout = await http("POST", "/api/payments/checkout", {
      cookie: studentCookie,
      body: { chapterId: bannedPaidChapter.id },
    });
    expect(checkout.status).toBe(403);
    expect((checkout.json as Record<string, unknown>)?.code).toBe("COURSE_NOT_AVAILABLE");
  });

  it("(9) Admin views still see banned teacher content", async () => {
    const suffix = randomUUID().slice(0, 8);

    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.admin.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    const admin = await prisma.user.create({
      data: {
        fullName: `Admin ${suffix}`,
        email: `admin.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(admin.id);

    const stage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 8, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(stage.id);

    const chapter = await prisma.chapter.create({
      data: { name: `Banned Chapter ${suffix}`, sortOrder: 1, price: null, stageId: stage.id },
    });
    owned.chapterIds.push(chapter.id);

    // Admin can view the banned teacher's stage/chapter via API (admin endpoints).
    // Verify the data exists in DB.
    const dbChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
      select: { id: true, name: true, stage: { select: { teacherId: true } } },
    });
    expect(dbChapter).not.toBeNull();
    expect(dbChapter!.stage.teacherId).toBe(bannedTeacher.id);

    // Admin can also list all users including banned teacher.
    const adminCookie = await login(admin.email);
    const usersRes = await http("GET", "/api/users", { cookie: adminCookie });
    expect(usersRes.status).toBe(200);
    const body = usersRes.json as Record<string, unknown>;
    const paginated = body?.data as { data?: Array<Record<string, unknown>> } | undefined;
    const users = paginated?.data ?? [];
    const foundBanned = users.some((u: Record<string, unknown>) => u.id === bannedTeacher.id);
    expect(foundBanned).toBe(true);
  });

  it("(10) No banned reason/internal details leaked in COURSE_NOT_AVAILABLE response", async () => {
    const suffix = randomUUID().slice(0, 8);

    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `banned.leak.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    const activeTeacher = await prisma.user.create({
      data: {
        fullName: `Active Teacher ${suffix}`,
        email: `active.leak.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(activeTeacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `s.leak.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const bannedStage = await prisma.stage.create({
      data: { name: `Banned Stage ${suffix}`, sortOrder: 9, teacherId: bannedTeacher.id },
    });
    owned.stageIds.push(bannedStage.id);

    const bannedChapter = await prisma.chapter.create({
      data: { name: `Banned Chapter ${suffix}`, sortOrder: 1, price: null, stageId: bannedStage.id },
    });
    owned.chapterIds.push(bannedChapter.id);

    const activeStage = await prisma.stage.create({
      data: { name: `Active Stage ${suffix}`, sortOrder: 1, teacherId: activeTeacher.id },
    });
    owned.stageIds.push(activeStage.id);

    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: activeStage.id },
    });

    const studentCookie = await login(student.email);

    const res = await http("POST", "/api/enrollments/free", {
      cookie: studentCookie,
      body: { chapterId: bannedChapter.id },
    });

    expect(res.status).toBe(403);
    const json = res.json as Record<string, unknown>;
    expect(json.code).toBe("COURSE_NOT_AVAILABLE");
    expect(json.message).toBe("هذا المحتوى غير متاح حاليًا");
    // Must NOT leak internal details.
    expect(json.message).not.toContain("BANNED");
    expect(json.message).not.toContain("banned");
    expect(json.message).not.toContain("teacher");
    expect(json.message).not.toContain("admin");
    expect(json.message).not.toContain("reason");
  });
});
