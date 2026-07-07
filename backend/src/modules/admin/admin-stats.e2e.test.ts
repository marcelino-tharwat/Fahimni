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
  planIds: [] as string[],
  subPaymentIds: [] as string[],
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

async function enroll(studentId: string, chapterId: string, status: "ACTIVE" | "PAYMENT_PENDING") {
  await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status },
  });
}

async function successPayment(studentId: string, chapterId: string, amount: number) {
  const p = await prisma.paymentTransaction.create({
    data: { studentId, chapterId, amount, status: "SUCCESS", paymobOrderId: `stats-${randomUUID()}` },
  });
  owned.paymentIds.push(p.id);
}

async function makePlan(): Promise<string> {
  const plan = await prisma.teacherPlan.create({
    data: { code: `STATS-${randomUUID().slice(0, 8)}`, name: "stats-plan", displayName: "Stats Plan", monthlyPrice: 199 },
  });
  owned.planIds.push(plan.id);
  return plan.id;
}

async function successSubPayment(teacherId: string, planId: string, amount: number) {
  const p = await prisma.teacherSubscriptionPayment.create({
    data: { teacherId, planId, amount, status: "SUCCESS", provider: "PAYMOB", providerOrderId: `stats-sub-${randomUUID()}` },
  });
  owned.subPaymentIds.push(p.id);
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

  // Dominant teacher: one huge SUCCESS course payment (guaranteed #1 by revenue)
  // + three distinct active-enrolled students + a confirmed subscription payment.
  dominantTeacherId = await makeUser("OPERATION");
  const chapterId = await makeStageChapter(dominantTeacherId);
  const payer = await makeUser("STUDENT");
  await successPayment(payer, chapterId, 10_000_000);
  for (let i = 0; i < 3; i++) {
    const s = await makeUser("STUDENT");
    await enroll(s, chapterId, "ACTIVE");
  }
  const planId = await makePlan();
  await successSubPayment(dominantTeacherId, planId, 777);
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPaymentIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.paymentIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

async function getStats(cookie: string) {
  return http("GET", "/api/admin/stats", { cookie });
}

type Stats = {
  users: Record<string, number>;
  content: Record<string, number>;
  learning: Record<string, number>;
  finance: {
    confirmedCourseRevenue: number;
    confirmedTeacherSubscriptionRevenue: number;
    totalConfirmedRevenue: number;
    monthlyConfirmedRevenue: number;
    estimatedSubscriptionRevenue: number;
    currency: string;
    reliabilityWarnings: string[];
  };
  operations: Record<string, number>;
  ai: Record<string, number>;
  topTeachers: {
    byRevenue: { teacherId: string; fullName: string; revenue: number }[];
    byStudents: { teacherId: string; fullName: string; studentCount: number }[];
  };
};

async function statsData(cookie = adminCookie): Promise<Stats> {
  return (await getStats(cookie)).json?.data as Stats;
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
    const d = await statsData();
    for (const k of ["totalTeachers", "activeTeachers", "totalStudents", "activeStudents", "studentsWithoutTeacher", "studentsWithoutAnyEnrollment"]) {
      expect(typeof d.users[k]).toBe("number");
    }
    for (const k of ["totalStages", "totalChapters", "totalLessons", "totalMaterials", "totalQuizzes", "publishedQuizzes", "draftQuizzes"]) {
      expect(typeof d.content[k]).toBe("number");
    }
    for (const k of ["totalEnrollments", "activeEnrollments", "pendingEnrollments", "quizAttempts", "averageQuizScore"]) {
      expect(typeof d.learning[k]).toBe("number");
    }
    for (const k of ["confirmedCourseRevenue", "confirmedTeacherSubscriptionRevenue", "totalConfirmedRevenue", "monthlyConfirmedRevenue", "estimatedSubscriptionRevenue"]) {
      expect(typeof (d.finance as unknown as Record<string, number>)[k]).toBe("number");
    }
    expect(d.finance.currency).toBe("EGP");
    expect(Array.isArray(d.finance.reliabilityWarnings)).toBe(true);
    expect(d.finance.reliabilityWarnings.length).toBeGreaterThan(0);
    for (const k of ["pendingTeacherRequests", "activeTeacherSubscriptions", "pendingTeacherSubscriptionRequests", "pendingTeacherSubscriptionPayments", "failedTeacherSubscriptionPayments"]) {
      expect(typeof d.operations[k]).toBe("number");
    }
    for (const k of ["quizGenerations", "essayGrading", "totalAiEvents"]) {
      expect(typeof d.ai[k]).toBe("number");
    }
    expect(Array.isArray(d.topTeachers.byRevenue)).toBe(true);
    expect(Array.isArray(d.topTeachers.byStudents)).toBe(true);
  });

  it("6 & 7. computes studentsWithoutTeacher and studentsWithoutAnyEnrollment correctly", async () => {
    const before = (await statsData()).users;

    // (a) Unassigned student, no enrollments → both metrics +1.
    await makeUser("STUDENT");
    const afterUnassigned = (await statsData()).users;
    expect(afterUnassigned.totalStudents).toBe(before.totalStudents + 1);
    expect(afterUnassigned.studentsWithoutTeacher).toBe(before.studentsWithoutTeacher + 1);
    expect(afterUnassigned.studentsWithoutAnyEnrollment).toBe(before.studentsWithoutAnyEnrollment + 1);

    // (b) Student with a PAYMENT_PENDING enrollment → has an enrollment (so
    // studentsWithoutAnyEnrollment unchanged) but no ACTIVE one (so
    // studentsWithoutTeacher +1).
    const pendingStudent = await makeUser("STUDENT");
    await enroll(pendingStudent, owned.chapterIds[0]!, "PAYMENT_PENDING");
    const afterPending = (await statsData()).users;
    expect(afterPending.totalStudents).toBe(afterUnassigned.totalStudents + 1);
    expect(afterPending.studentsWithoutTeacher).toBe(afterUnassigned.studentsWithoutTeacher + 1);
    expect(afterPending.studentsWithoutAnyEnrollment).toBe(afterUnassigned.studentsWithoutAnyEnrollment);

    // (c) Student with an ACTIVE enrollment → neither "without" metric changes.
    const activeStudent = await makeUser("STUDENT");
    await enroll(activeStudent, owned.chapterIds[0]!, "ACTIVE");
    const afterActive = (await statsData()).users;
    expect(afterActive.studentsWithoutTeacher).toBe(afterPending.studentsWithoutTeacher);
    expect(afterActive.studentsWithoutAnyEnrollment).toBe(afterPending.studentsWithoutAnyEnrollment);
  });

  it("8. confirmedCourseRevenue equals the sum of successful PaymentTransaction", async () => {
    const d = await statsData();
    const agg = await prisma.paymentTransaction.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } });
    expect(d.finance.confirmedCourseRevenue).toBe(Number(agg._sum.amount ?? 0));
  });

  it("9. confirmedTeacherSubscriptionRevenue equals the sum of successful TeacherSubscriptionPayment", async () => {
    const d = await statsData();
    const agg = await prisma.teacherSubscriptionPayment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } });
    expect(d.finance.confirmedTeacherSubscriptionRevenue).toBe(Number(agg._sum.amount ?? 0));
    // Our fixture contributed a confirmed 777 subscription payment.
    expect(d.finance.confirmedTeacherSubscriptionRevenue).toBeGreaterThanOrEqual(777);
    // Because confirmed subscription revenue exists, the estimate is not used.
    expect(d.finance.estimatedSubscriptionRevenue).toBe(0);
  });

  it("10. totalConfirmedRevenue equals course + subscription confirmed revenue", async () => {
    const d = await statsData();
    expect(d.finance.totalConfirmedRevenue).toBe(
      d.finance.confirmedCourseRevenue + d.finance.confirmedTeacherSubscriptionRevenue,
    );
  });

  it("11. monthlyConfirmedRevenue includes both course and subscription payments", async () => {
    const d = await statsData();
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [course, sub] = await Promise.all([
      prisma.paymentTransaction.aggregate({ where: { status: "SUCCESS", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.teacherSubscriptionPayment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    ]);
    expect(d.finance.monthlyConfirmedRevenue).toBe(Number(course._sum.amount ?? 0) + Number(sub._sum.amount ?? 0));
  });

  it("12. topTeachers.byStudents is sorted and matches an independent recompute", async () => {
    const { byStudents } = (await statsData()).topTeachers;
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

  it("13. topTeachers.byRevenue uses course revenue only (subscription payments excluded)", async () => {
    const { byRevenue } = (await statsData()).topTeachers;
    // Dominant teacher's 10,000,000 course payment ranks #1 — and does NOT include
    // the 777 subscription payment (subscription = platform revenue, not teacher-earned).
    expect(byRevenue[0]?.teacherId).toBe(dominantTeacherId);
    expect(byRevenue[0]?.revenue).toBe(10_000_000);
    for (let i = 1; i < byRevenue.length; i++) {
      expect(byRevenue[i - 1]!.revenue).toBeGreaterThanOrEqual(byRevenue[i]!.revenue);
    }
    const top = byRevenue[0]!;
    const agg = await prisma.paymentTransaction.aggregate({
      where: { status: "SUCCESS", chapter: { stage: { teacherId: top.teacherId } } },
      _sum: { amount: true },
    });
    expect(top.revenue).toBe(Number(agg._sum.amount ?? 0));
  });

  it("14. never exposes sensitive fields", async () => {
    const r = await getStats(adminCookie);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/password|tokenVersion|rawCallback|storageKey|filePath/i);
  });
});
