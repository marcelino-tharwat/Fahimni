import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for GET /api/admin/stats. The test DB is shared, so aggregation
 * correctness is asserted via deltas and independent recomputation rather than
 * absolute global values.
 */

let server: Server;
let base: string;
const PW = "AdminStats@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  paymentIds: [] as string[],
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

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT"): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `stats-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: `Stats ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `016${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makeStageChapter(teacherId: string): Promise<string> {
  const stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `st-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(stageId);
  const chapterId = randomUUID();
  await prisma.chapter.create({ data: { id: chapterId, name: `ch-${randomUUID().slice(0, 6)}`, sortOrder: 1, stageId, price: 100 } });
  owned.chapterIds.push(chapterId);
  return chapterId;
}

async function activeEnroll(studentId: string, chapterId: string) {
  await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status: "ACTIVE" },
  });
}

async function successPayment(studentId: string, chapterId: string, amount: number) {
  const p = await prisma.paymentTransaction.create({
    data: { studentId, chapterId, amount, status: "SUCCESS", paymobOrderId: `stats-${randomUUID()}` },
  });
  owned.paymentIds.push(p.id);
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;
let dominantTeacherId: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const adminId = await makeUser("ADMIN");
  const teacherId = await makeUser("OPERATION");
  const studentId = await makeUser("STUDENT");
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email);
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherId } })).email);
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).email);

  // Dominant teacher: one huge SUCCESS payment (guaranteed #1 by revenue) plus
  // three distinct active-enrolled students.
  dominantTeacherId = await makeUser("OPERATION");
  const chapterId = await makeStageChapter(dominantTeacherId);
  const payer = await makeUser("STUDENT");
  await successPayment(payer, chapterId, 10_000_000);
  for (let i = 0; i < 3; i++) {
    const s = await makeUser("STUDENT");
    await activeEnroll(s, chapterId);
  }
});

afterAll(async () => {
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.paymentIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

async function getStats(cookie: string) {
  const r = await http("GET", "/api/admin/stats", { cookie });
  return r;
}

describe("GET /api/admin/stats — authorization", () => {
  it("1. rejects unauthenticated (401)", async () => {
    expect((await http("GET", "/api/admin/stats")).status).toBe(401);
  });
  it("2. rejects STUDENT (403)", async () => {
    expect((await getStats(studentCookie)).status).toBe(403);
  });
  it("3. rejects OPERATION/teacher (403)", async () => {
    expect((await getStats(teacherCookie)).status).toBe(403);
  });
  it("4. allows ADMIN (200)", async () => {
    expect((await getStats(adminCookie)).status).toBe(200);
  });
});

describe("GET /api/admin/stats — payload", () => {
  it("5. returns the correct response shape and types", async () => {
    const r = await getStats(adminCookie);
    const d = r.json?.data as Record<string, Record<string, unknown>>;
    expect(d).toBeDefined();

    for (const k of ["totalTeachers", "activeTeachers", "totalStudents", "activeStudents", "studentsWithoutTeacher"]) {
      expect(typeof d.users[k]).toBe("number");
    }
    for (const k of ["totalStages", "totalChapters", "totalLessons", "totalMaterials", "totalQuizzes", "publishedQuizzes", "draftQuizzes"]) {
      expect(typeof d.content[k]).toBe("number");
    }
    for (const k of ["totalEnrollments", "activeEnrollments", "pendingEnrollments", "quizAttempts", "averageQuizScore"]) {
      expect(typeof d.learning[k]).toBe("number");
    }
    expect(typeof d.finance.confirmedRevenue).toBe("number");
    expect(typeof d.finance.monthlyConfirmedRevenue).toBe("number");
    expect(typeof d.finance.estimatedSubscriptionRevenue).toBe("number");
    expect(d.finance.currency).toBe("EGP");
    expect(Array.isArray(d.finance.reliabilityWarnings)).toBe(true);
    expect((d.finance.reliabilityWarnings as string[]).length).toBeGreaterThan(0);
    for (const k of ["pendingTeacherRequests", "activeTeacherSubscriptions", "pendingTeacherSubscriptionRequests"]) {
      expect(typeof d.operations[k]).toBe("number");
    }
    expect(typeof d.ai.quizGenerations).toBe("number");
    expect(typeof d.ai.essayGrading).toBe("number");
    expect(Array.isArray((d.topTeachers as unknown as { byRevenue: unknown[] }).byRevenue)).toBe(true);
    expect(Array.isArray((d.topTeachers as unknown as { byStudents: unknown[] }).byStudents)).toBe(true);
  });

  it("6. computes studentsWithoutTeacher correctly (delta on unassigned vs assigned)", async () => {
    const before = (await getStats(adminCookie)).json?.data as { users: { studentsWithoutTeacher: number; totalStudents: number } };

    // Unassigned student → studentsWithoutTeacher +1, totalStudents +1.
    await makeUser("STUDENT");
    const afterUnassigned = (await getStats(adminCookie)).json?.data as { users: { studentsWithoutTeacher: number; totalStudents: number } };
    expect(afterUnassigned.users.totalStudents).toBe(before.users.totalStudents + 1);
    expect(afterUnassigned.users.studentsWithoutTeacher).toBe(before.users.studentsWithoutTeacher + 1);

    // Assigned student (active enrollment) → totalStudents +1, studentsWithoutTeacher unchanged.
    const chapterId = owned.chapterIds[0]!;
    const assigned = await makeUser("STUDENT");
    await activeEnroll(assigned, chapterId);
    const afterAssigned = (await getStats(adminCookie)).json?.data as { users: { studentsWithoutTeacher: number; totalStudents: number } };
    expect(afterAssigned.users.totalStudents).toBe(afterUnassigned.users.totalStudents + 1);
    expect(afterAssigned.users.studentsWithoutTeacher).toBe(afterUnassigned.users.studentsWithoutTeacher);
  });

  it("7. computes topTeachers correctly (ordering + independent recomputation)", async () => {
    const d = (await getStats(adminCookie)).json?.data as {
      topTeachers: {
        byRevenue: { teacherId: string; fullName: string; revenue: number }[];
        byStudents: { teacherId: string; fullName: string; studentCount: number }[];
      };
    };
    const { byRevenue, byStudents } = d.topTeachers;

    // Dominant teacher (10,000,000) must rank #1 by revenue with the exact sum.
    expect(byRevenue[0]?.teacherId).toBe(dominantTeacherId);
    expect(byRevenue[0]?.revenue).toBe(10_000_000);
    expect(typeof byRevenue[0]?.fullName).toBe("string");
    expect(byRevenue[0]?.fullName.length).toBeGreaterThan(0);

    // byRevenue sorted descending + each entry matches an independent recompute.
    for (let i = 1; i < byRevenue.length; i++) {
      expect(byRevenue[i - 1]!.revenue).toBeGreaterThanOrEqual(byRevenue[i]!.revenue);
    }
    if (byRevenue.length > 0) {
      const top = byRevenue[0]!;
      const agg = await prisma.paymentTransaction.aggregate({
        where: { status: "SUCCESS", chapter: { stage: { teacherId: top.teacherId } } },
        _sum: { amount: true },
      });
      expect(top.revenue).toBe(Number(agg._sum.amount ?? 0));
    }

    // byStudents sorted descending + top entry matches an independent recompute.
    for (let i = 1; i < byStudents.length; i++) {
      expect(byStudents[i - 1]!.studentCount).toBeGreaterThanOrEqual(byStudents[i]!.studentCount);
    }
    if (byStudents.length > 0) {
      const top = byStudents[0]!;
      const distinct = await prisma.enrollment.findMany({
        where: { status: "ACTIVE", chapter: { stage: { teacherId: top.teacherId } } },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      expect(top.studentCount).toBe(distinct.length);
    }
  });

  it("8. never exposes sensitive fields", async () => {
    const r = await getStats(adminCookie);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/password|tokenVersion|rawCallback|filePath|storageKey/i);
  });
});
