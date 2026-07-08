import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the Admin Teacher Detail endpoints. Uses the isolated test DB with
 * self-owned fixtures torn down afterwards. Correctness is asserted by
 * teacher-scoped recomputation, not absolute globals.
 */

let server: Server;
let base: string;
const PW = "TeacherDetail@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  paymentIds: [] as string[],
  planIds: [] as string[],
  subPaymentIds: [] as string[],
  aiEventIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
  setCookie: string[];
}

async function http(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
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
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT"): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `td-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: `TD ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `018${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
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
  await prisma.enrollment.create({ data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status } });
}

async function successPayment(studentId: string, chapterId: string, amount: number) {
  const p = await prisma.paymentTransaction.create({
    data: {
      studentId,
      chapterId,
      amount,
      status: "SUCCESS",
      paymobOrderId: `td-order-${randomUUID()}`,
      paymobTransactionId: `td-txn-${randomUUID()}`,
      rawCallback: { secret: "COURSE_CALLBACK_SECRET" },
    },
  });
  owned.paymentIds.push(p.id);
}

async function makePlan(): Promise<string> {
  const plan = await prisma.teacherPlan.create({
    data: { code: `TD-${randomUUID().slice(0, 8)}`, name: "td-plan", displayName: "TD Plan", monthlyPrice: 199 },
  });
  owned.planIds.push(plan.id);
  return plan.id;
}

async function subPayment(teacherId: string, planId: string, amount: number, status: "SUCCESS" | "PENDING" | "FAILED") {
  const p = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId,
      planId,
      amount,
      status,
      provider: "PAYMOB",
      providerOrderId: `td-sub-order-${randomUUID()}`,
      providerTransactionId: `td-sub-txn-${randomUUID()}`,
      checkoutUrl: "https://paymob.example/checkout/secret",
      rawCallback: { secret: "SUB_CALLBACK_SECRET" },
    },
  });
  owned.subPaymentIds.push(p.id);
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

let teacherA: string; // full fixture (revenue, students, subscription payments)
let teacherB: string; // shares a student with A
let chapterA: string;
let chapterB: string;
let sharedStudent: string;
let soloStudentA: string;
const COURSE_AMOUNT = 5432;
const SUB_SUCCESS_AMOUNT = 321;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const adminId = await makeUser("ADMIN");
  const teacherId = await makeUser("OPERATION"); // an unrelated teacher for the 403 check
  const studentId = await makeUser("STUDENT");
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email);
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherId } })).email);
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).email);

  teacherA = await makeUser("OPERATION");
  teacherB = await makeUser("OPERATION");
  chapterA = await makeStageChapter(teacherA);
  chapterB = await makeStageChapter(teacherB);

  // Shared student enrolled with BOTH teachers.
  sharedStudent = await makeUser("STUDENT");
  await enroll(sharedStudent, chapterA, "ACTIVE");
  await enroll(sharedStudent, chapterB, "ACTIVE");

  // A student only with teacher A (+ a PENDING enrollment).
  soloStudentA = await makeUser("STUDENT");
  await enroll(soloStudentA, chapterA, "ACTIVE");
  const pendingStudentA = await makeUser("STUDENT");
  await enroll(pendingStudentA, chapterA, "PAYMENT_PENDING");

  // Course revenue for teacher A.
  const payer = await makeUser("STUDENT");
  await successPayment(payer, chapterA, COURSE_AMOUNT);

  // Subscription payments for teacher A: one SUCCESS, one PENDING, one FAILED.
  const planId = await makePlan();
  await subPayment(teacherA, planId, SUB_SUCCESS_AMOUNT, "SUCCESS");
  await subPayment(teacherA, planId, 100, "PENDING");
  await subPayment(teacherA, planId, 50, "FAILED");

  // AI usage for teacher A.
  const ev1 = await prisma.teacherAiUsageEvent.create({ data: { teacherId: teacherA, usageType: "AI_QUIZ_GENERATION", units: 3 } });
  const ev2 = await prisma.teacherAiUsageEvent.create({ data: { teacherId: teacherA, usageType: "AI_ESSAY_GRADING", units: 2 } });
  owned.aiEventIds.push(ev1.id, ev2.id);
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPaymentIds } } });
  await prisma.teacherAiUsageEvent.deleteMany({ where: { id: { in: owned.aiEventIds } } });
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

const g = (p: string, cookie = adminCookie) => http("GET", p, { cookie });
const dataOf = (r: HttpResult) => r.json?.data as Record<string, unknown>;

describe("Admin Teacher Detail — authorization & 404", () => {
  it("1. ADMIN can get teacher detail (200)", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}`);
    expect(r.status).toBe(200);
    expect((dataOf(r).teacher as { id: string }).id).toBe(teacherA);
  });

  it("2. invalid teacher returns 404 (nonexistent uuid AND malformed id)", async () => {
    expect((await g(`/api/admin/teachers/${randomUUID()}`)).status).toBe(404);
    expect((await g(`/api/admin/teachers/not-a-uuid`)).status).toBe(404);
  });

  it("2b. a STUDENT id returns 404 (role must be OPERATION)", async () => {
    const studentOnly = await makeUser("STUDENT");
    expect((await g(`/api/admin/teachers/${studentOnly}`)).status).toBe(404);
  });

  it("3. STUDENT denied (403)", async () => {
    expect((await g(`/api/admin/teachers/${teacherA}`, studentCookie)).status).toBe(403);
  });

  it("4. OPERATION denied (403)", async () => {
    expect((await g(`/api/admin/teachers/${teacherA}`, teacherCookie)).status).toBe(403);
  });

  it("5. unauthenticated denied (401)", async () => {
    expect((await http("GET", `/api/admin/teachers/${teacherA}`)).status).toBe(401);
  });
});

describe("Admin Teacher Detail — scoping & payload", () => {
  it("6 & 8. students endpoint is scoped to the selected teacher (excludes other teachers)", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/students?limit=100`);
    const students = (dataOf(r).data as { id: string }[]).map((s) => s.id);
    // Independent recompute of distinct students through teacher A's chapters.
    const distinct = await prisma.enrollment.findMany({
      where: { chapter: { stage: { teacherId: teacherA } } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    expect(new Set(students)).toEqual(new Set(distinct.map((d) => d.studentId)));
    expect(students).toContain(sharedStudent);
    expect(students).toContain(soloStudentA);
  });

  it("7. a shared student shows ONLY the selected teacher's enrollments", async () => {
    const rA = await g(`/api/admin/teachers/${teacherA}/students?limit=100`);
    const sharedA = (dataOf(rA).data as { id: string; enrollments: { chapter: { id: string } }[] }[]).find(
      (s) => s.id === sharedStudent,
    )!;
    expect(sharedA.enrollments.every((e) => e.chapter.id === chapterA)).toBe(true);
    expect(sharedA.enrollments.some((e) => e.chapter.id === chapterB)).toBe(false);

    // Same shared student under teacher B shows only chapter B.
    const rB = await g(`/api/admin/teachers/${teacherB}/students?limit=100`);
    const sharedB = (dataOf(rB).data as { id: string; enrollments: { chapter: { id: string } }[] }[]).find(
      (s) => s.id === sharedStudent,
    )!;
    expect(sharedB.enrollments.every((e) => e.chapter.id === chapterB)).toBe(true);
  });

  it("8b. enrollments endpoint excludes other teachers' chapters", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/enrollments?limit=100`);
    const rows = dataOf(r).data as { chapter: { id: string; stageId: string } }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => e.chapter.id === chapterA)).toBe(true);
    // Recompute count.
    const count = await prisma.enrollment.count({ where: { chapter: { stage: { teacherId: teacherA } } } });
    expect((dataOf(r).meta as { total: number }).total).toBe(count);
  });

  it("enrollments status filter works", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/enrollments?status=PAYMENT_PENDING&limit=100`);
    const rows = dataOf(r).data as { status: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => e.status === "PAYMENT_PENDING")).toBe(true);
  });

  it("9. course revenue is scoped to the teacher's chapters", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/revenue`);
    const rev = dataOf(r);
    const agg = await prisma.paymentTransaction.aggregate({
      where: { status: "SUCCESS", chapter: { stage: { teacherId: teacherA } } },
      _sum: { amount: true },
    });
    expect(rev.confirmedCourseRevenue).toBe(Number(agg._sum.amount ?? 0));
    expect(rev.confirmedCourseRevenue).toBeGreaterThanOrEqual(COURSE_AMOUNT);
    // Teacher B (no course payments) shows 0.
    const rB = await g(`/api/admin/teachers/${teacherB}/revenue`);
    expect(dataOf(rB).confirmedCourseRevenue).toBe(0);
  });

  it("10 & 11. subscription payments scoped to teacherId + current subscription safe", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/subscription`);
    const sub = dataOf(r);
    const subAgg = await prisma.teacherSubscriptionPayment.aggregate({
      where: { teacherId: teacherA, status: "SUCCESS" },
      _sum: { amount: true },
    });
    const latest = sub.latestSuccessfulPayments as { amount: number }[];
    const latestTotal = latest.reduce((s, p) => s + p.amount, 0);
    expect(latestTotal).toBeGreaterThanOrEqual(SUB_SUCCESS_AMOUNT);
    expect(Number(subAgg._sum.amount ?? 0)).toBeGreaterThanOrEqual(SUB_SUCCESS_AMOUNT);
    expect(sub.failedPaymentsCount).toBe(1);
    expect(sub.pendingPayment).not.toBeNull();

    // Teacher B has no subscription payments → counts zeroed, arrays empty.
    const rB = await g(`/api/admin/teachers/${teacherB}/subscription`);
    expect((dataOf(rB).latestSuccessfulPayments as unknown[]).length).toBe(0);
  });

  it("revenue keeps course revenue and subscription payments as SEPARATE figures", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/revenue`);
    const rev = dataOf(r) as {
      confirmedCourseRevenue: number;
      subscriptionPayments: { confirmedTotal: number };
    };
    // Distinct values, sourced from distinct tables; never summed together.
    expect(rev.confirmedCourseRevenue).toBeGreaterThanOrEqual(COURSE_AMOUNT);
    expect(rev.subscriptionPayments.confirmedTotal).toBeGreaterThanOrEqual(SUB_SUCCESS_AMOUNT);
    expect(rev.confirmedCourseRevenue).not.toBe(rev.subscriptionPayments.confirmedTotal);
  });

  it("content endpoint returns scoped counts + tree", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/content`);
    const content = dataOf(r) as { counts: { stagesCount: number; chaptersCount: number }; stages: unknown[] };
    expect(content.counts.stagesCount).toBeGreaterThanOrEqual(1);
    expect(content.counts.chaptersCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(content.stages)).toBe(true);
  });

  it("ai-usage groups by type with totals", async () => {
    const r = await g(`/api/admin/teachers/${teacherA}/ai-usage`);
    const ai = dataOf(r) as { byType: { type: string; units: number }[]; totalUnits: number; totalEvents: number };
    expect(ai.totalEvents).toBeGreaterThanOrEqual(2);
    expect(ai.totalUnits).toBeGreaterThanOrEqual(5);
    expect(ai.byType.length).toBeGreaterThanOrEqual(2);
  });

  it("12. no sensitive fields exposed across ANY detail endpoint", async () => {
    const paths = [
      `/api/admin/teachers/${teacherA}`,
      `/api/admin/teachers/${teacherA}/students?limit=100`,
      `/api/admin/teachers/${teacherA}/enrollments?limit=100`,
      `/api/admin/teachers/${teacherA}/content`,
      `/api/admin/teachers/${teacherA}/revenue`,
      `/api/admin/teachers/${teacherA}/subscription`,
      `/api/admin/teachers/${teacherA}/ai-usage`,
    ];
    for (const p of paths) {
      const raw = JSON.stringify((await g(p)).json);
      expect(raw).not.toMatch(
        /password|tokenVersion|rawCallback|paymobOrderId|paymobTransactionId|providerOrderId|providerTransactionId|checkoutUrl|storageKey|filePath|COURSE_CALLBACK_SECRET|SUB_CALLBACK_SECRET/i,
      );
    }
  });
});
