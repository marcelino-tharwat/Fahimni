/**
 * E2E: student All Content shows chapters from all valid teachers in the
 * student's stage, excludes invalid teachers, and My Courses stays intact.
 *
 * Verifies:
 * 1. All Content returns chapters from teacher A and teacher B for same student stage.
 * 2. All Content is filtered by student's stage.
 * 3. All Content excludes chapters from other stages.
 * 4. All Content excludes banned/inactive/rejected teachers.
 * 5. All Content includes approved FREE teacher.
 * 6. All Content is not limited to one teacher.
 * 7. My Courses still returns enrolled content.
 * 8. New enrollment works for valid teacher content.
 * 9. New enrollment blocked for invalid teacher content.
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
const PW = "MultiTeacherE2E@123";
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
  const r = await http("POST", "/api/v1/auth/login", {
    body: { email, password: PW },
  });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

function mobile(): string {
  return (
    "011" +
    String(Date.now()).slice(-8) +
    String(Math.floor(Math.random() * 100)).padStart(2, "0")
  );
}

/** Collect all chapter IDs from the student tree response. */
function treeChapterIds(tree: unknown): string[] {
  const stages = tree as Array<{
    chapters?: Array<{ chapter?: { id: string } }>;
  }>;
  const ids: string[] = [];
  for (const stage of stages) {
    for (const ch of stage.chapters ?? []) {
      if (ch.chapter?.id) ids.push(ch.chapter.id);
    }
  }
  return ids;
}

/** Check if a chapter id appears in the student tree response. */
function treeHasChapter(tree: unknown, chapterId: string): boolean {
  return treeChapterIds(tree).includes(chapterId);
}

/** Get teacher info from a chapter in the tree. */
function treeChapterTeacher(
  tree: unknown,
  chapterId: string,
): { id: string; fullName: string; subject: string | null } | undefined {
  const stages = tree as Array<{
    chapters?: Array<{
      chapter?: {
        id: string;
        teacher?: { id: string; fullName: string; subject: string | null };
      };
    }>;
  }>;
  for (const stage of stages) {
    for (const ch of stage.chapters ?? []) {
      if (ch.chapter?.id === chapterId) return ch.chapter.teacher;
    }
  }
  return undefined;
}

/** Count unique teacher IDs across all chapters in the tree. */
function treeUniqueTeacherCount(tree: unknown): number {
  const stages = tree as Array<{
    chapters?: Array<{
      chapter?: { teacher?: { id: string } };
    }>;
  }>;
  const teacherIds = new Set<string>();
  for (const stage of stages) {
    for (const ch of stage.chapters ?? []) {
      if (ch.chapter?.teacher?.id) teacherIds.add(ch.chapter.teacher.id);
    }
  }
  return teacherIds.size;
}

/** Check if a chapter id appears in the my-courses response. */
function myCoursesHasChapter(response: unknown, chapterId: string): boolean {
  const raw = response as Record<string, unknown>;
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? (raw.data as Array<Record<string, unknown>>)
      : [];
  return arr.some(
    (c: Record<string, unknown>) =>
      c.id === chapterId ||
      (c.chapter &&
        (c.chapter as Record<string, unknown>).id === chapterId),
  );
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
  await prisma.lessonProgress.deleteMany({
    where: { lessonId: { in: owned.lessonIds } },
  });
  await prisma.enrollment.deleteMany({
    where: { chapterId: { in: owned.chapterIds } },
  });
  await prisma.lesson.deleteMany({
    where: { id: { in: owned.lessonIds } },
  });
  await prisma.chapter.deleteMany({
    where: { id: { in: owned.chapterIds } },
  });
  await prisma.studentProfile.deleteMany({
    where: { stageId: { in: owned.stageIds } },
  });
  await prisma.stage.deleteMany({
    where: { id: { in: owned.stageIds } },
  });
  await prisma.auditLog.deleteMany({
    where: { userId: { in: owned.userIds } },
  });
  await prisma.teacherProfile.deleteMany({
    where: { userId: { in: owned.userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: owned.userIds } },
  });
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("student All Content — stage-scoped multi-teacher", () => {
  /**
   * Shared fixture: one shared stage, two valid teachers + one banned teacher,
   * each with chapters in the same stage. One student in that stage.
   */
  async function createFixture() {
    const suffix = randomUUID().slice(0, 8);

    // Teacher A: ACTIVE + APPROVED (paid plan)
    const teacherA = await prisma.user.create({
      data: {
        fullName: `Teacher A ${suffix}`,
        email: `teacherA.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(teacherA.id);

    // Teacher B: ACTIVE + APPROVED (FREE plan — no paid subscription)
    const teacherB = await prisma.user.create({
      data: {
        fullName: `Teacher B ${suffix}`,
        email: `teacherB.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(teacherB.id);

    // Banned teacher: ACTIVE + APPROVED but status = BANNED
    const bannedTeacher = await prisma.user.create({
      data: {
        fullName: `Banned Teacher ${suffix}`,
        email: `bannedT.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "BANNED",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(bannedTeacher.id);

    // Inactive teacher: status = INACTIVE
    const inactiveTeacher = await prisma.user.create({
      data: {
        fullName: `Inactive Teacher ${suffix}`,
        email: `inactiveT.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "INACTIVE",
        teacherApprovalState: "APPROVED",
      },
    });
    owned.userIds.push(inactiveTeacher.id);

    // Rejected teacher: teacherApprovalState = REJECTED
    const rejectedTeacher = await prisma.user.create({
      data: {
        fullName: `Rejected Teacher ${suffix}`,
        email: `rejectedT.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "INACTIVE",
        teacherApprovalState: "REJECTED",
      },
    });
    owned.userIds.push(rejectedTeacher.id);

    // Student
    const student = await prisma.user.create({
      data: {
        fullName: `Student ${suffix}`,
        email: `student.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    // Shared stage
    const stage = await prisma.stage.create({
      data: {
        name: `Shared Stage ${suffix}`,
        sortOrder: 1,
      },
    });
    owned.stageIds.push(stage.id);

    // Teacher A chapter (in shared stage)
    const chapterA = await prisma.chapter.create({
      data: {
        name: `Chapter A ${suffix}`,
        sortOrder: 1,
        price: 100,
        stageId: stage.id,
        teacherId: teacherA.id,
      },
    });
    owned.chapterIds.push(chapterA.id);

    // Teacher B chapter (in shared stage) — free
    const chapterB = await prisma.chapter.create({
      data: {
        name: `Chapter B ${suffix}`,
        sortOrder: 2,
        price: null,
        stageId: stage.id,
        teacherId: teacherB.id,
      },
    });
    owned.chapterIds.push(chapterB.id);

    // Banned teacher chapter (in shared stage)
    const chapterBanned = await prisma.chapter.create({
      data: {
        name: `Chapter Banned ${suffix}`,
        sortOrder: 3,
        price: null,
        stageId: stage.id,
        teacherId: bannedTeacher.id,
      },
    });
    owned.chapterIds.push(chapterBanned.id);

    // Inactive teacher chapter (in shared stage)
    const chapterInactive = await prisma.chapter.create({
      data: {
        name: `Chapter Inactive ${suffix}`,
        sortOrder: 4,
        price: null,
        stageId: stage.id,
        teacherId: inactiveTeacher.id,
      },
    });
    owned.chapterIds.push(chapterInactive.id);

    // Rejected teacher chapter (in shared stage)
    const chapterRejected = await prisma.chapter.create({
      data: {
        name: `Chapter Rejected ${suffix}`,
        sortOrder: 5,
        price: null,
        stageId: stage.id,
        teacherId: rejectedTeacher.id,
      },
    });
    owned.chapterIds.push(chapterRejected.id);

    // Lessons for chapter A
    const lessonA1 = await prisma.lesson.create({
      data: {
        title: `Lesson A1 ${suffix}`,
        durationMinutes: 10,
        sortOrder: 1,
        chapterId: chapterA.id,
      },
    });
    owned.lessonIds.push(lessonA1.id);

    const lessonA2 = await prisma.lesson.create({
      data: {
        title: `Lesson A2 ${suffix}`,
        durationMinutes: 15,
        sortOrder: 2,
        chapterId: chapterA.id,
      },
    });
    owned.lessonIds.push(lessonA2.id);

    // Lesson for chapter B
    const lessonB1 = await prisma.lesson.create({
      data: {
        title: `Lesson B1 ${suffix}`,
        durationMinutes: 20,
        sortOrder: 1,
        chapterId: chapterB.id,
      },
    });
    owned.lessonIds.push(lessonB1.id);

    // Student profile → shared stage
    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: stage.id },
    });

    // Teacher profiles
    await prisma.teacherProfile.create({
      data: { userId: teacherA.id, subject: "Math" },
    });
    await prisma.teacherProfile.create({
      data: { userId: teacherB.id, subject: "Science" },
    });

    return {
      teacherA,
      teacherB,
      bannedTeacher,
      inactiveTeacher,
      rejectedTeacher,
      student,
      stage,
      chapterA,
      chapterB,
      chapterBanned,
      chapterInactive,
      chapterRejected,
      lessonA1,
      lessonA2,
      lessonB1,
      suffix,
    };
  }

  it("(1) All Content returns chapters from teacher A and teacher B for same student stage", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);

    // Both valid teacher chapters present
    expect(treeHasChapter(tree.json, f.chapterA.id)).toBe(true);
    expect(treeHasChapter(tree.json, f.chapterB.id)).toBe(true);
  });

  it("(2) All Content is filtered by student's stage", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);

    // Only the student's stage should appear
    const stages = tree.json as Array<{ stage?: { id: string } }>;
    const stageIds = stages.map((s) => s.stage?.id);
    expect(stageIds).toContain(f.stage.id);
    expect(stageIds.length).toBe(1); // exactly one stage
  });

  it("(3) All Content excludes chapters from other stages", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    // Create a chapter in a DIFFERENT stage
    const otherStage = await prisma.stage.create({
      data: { name: `Other Stage ${f.suffix}`, sortOrder: 99 },
    });
    owned.stageIds.push(otherStage.id);

    const otherChapter = await prisma.chapter.create({
      data: {
        name: `Other Chapter ${f.suffix}`,
        sortOrder: 1,
        price: null,
        stageId: otherStage.id,
        teacherId: f.teacherA.id, // same valid teacher, different stage
      },
    });
    owned.chapterIds.push(otherChapter.id);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);
    expect(treeHasChapter(tree.json, otherChapter.id)).toBe(false);
  });

  it("(4) All Content excludes banned/inactive/rejected teachers", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);

    expect(treeHasChapter(tree.json, f.chapterBanned.id)).toBe(false);
    expect(treeHasChapter(tree.json, f.chapterInactive.id)).toBe(false);
    expect(treeHasChapter(tree.json, f.chapterRejected.id)).toBe(false);
  });

  it("(5) All Content includes approved FREE teacher", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);

    // Teacher B is APPROVED + ACTIVE (FREE plan — no paid subscription needed)
    expect(treeHasChapter(tree.json, f.chapterB.id)).toBe(true);

    // Teacher info is present
    const teacherInfo = treeChapterTeacher(tree.json, f.chapterB.id);
    expect(teacherInfo).toBeDefined();
    expect(teacherInfo!.id).toBe(f.teacherB.id);
    expect(teacherInfo!.fullName).toBe(f.teacherB.fullName);
  });

  it("(6) All Content is not limited to one teacher — shows multiple teachers", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    const tree = await http("GET", "/api/content/student/tree", { cookie });
    expect(tree.status).toBe(200);

    const uniqueTeachers = treeUniqueTeacherCount(tree.json);
    expect(uniqueTeachers).toBeGreaterThanOrEqual(2);

    // Both valid teachers present
    const ids = treeChapterIds(tree.json);
    expect(ids).toContain(f.chapterA.id);
    expect(ids).toContain(f.chapterB.id);

    // No duplicate chapters
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("(7) My Courses still returns enrolled content", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    // Enroll in teacher A's chapter
    await prisma.enrollment.create({
      data: {
        studentId: f.student.id,
        chapterId: f.chapterA.id,
        price: 100,
        paymentMethod: "PAYMOB",
      },
    });

    const myCourses = await http("GET", "/api/content/student/my-courses", {
      cookie,
    });
    expect(myCourses.status).toBe(200);
    expect(myCoursesHasChapter(myCourses.json, f.chapterA.id)).toBe(true);
  });

  it("(8) New enrollment works for valid teacher content", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    // Enroll in teacher B's free chapter
    const enroll = await http("POST", "/api/enrollments/free", {
      cookie,
      body: { chapterId: f.chapterB.id },
    });
    expect(enroll.status).toBe(201);

    // Verify enrollment exists
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_chapterId: {
          studentId: f.student.id,
          chapterId: f.chapterB.id,
        },
      },
    });
    expect(enrollment).not.toBeNull();
    expect(enrollment!.status).toBe("ACTIVE");
  });

  it("(9) New enrollment blocked for invalid teacher content", async () => {
    const f = await createFixture();
    const cookie = await login(f.student.email);

    // Attempt to enroll in banned teacher's free chapter
    const enroll = await http("POST", "/api/enrollments/free", {
      cookie,
      body: { chapterId: f.chapterBanned.id },
    });
    expect(enroll.status).toBe(403);
    expect((enroll.json as Record<string, unknown>)?.code).toBe(
      "COURSE_NOT_AVAILABLE",
    );

    // Attempt to enroll in inactive teacher's free chapter
    const enrollInactive = await http("POST", "/api/enrollments/free", {
      cookie,
      body: { chapterId: f.chapterInactive.id },
    });
    expect(enrollInactive.status).toBe(403);
    expect((enrollInactive.json as Record<string, unknown>)?.code).toBe(
      "COURSE_NOT_AVAILABLE",
    );
  });
});
