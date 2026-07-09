import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the Admin Revenue & Payments module. Isolated test DB, self-owned
 * fixtures (unique run token). Verifies the SUCCESS-only revenue policy, free vs
 * paid teacher counting, payment sanitisation, and ADMIN-only access.
 */

let server: Server;
let base: string;
const PW = "AdminRev@123";
const RUN = randomUUID().slice(0, 8);
let pwHash: string;

const owned = {
  userIds: [] as string[], planIds: [] as string[], stageIds: [] as string[],
  chapterIds: [] as string[], subscriptionIds: [] as string[],
  coursePayIds: [] as string[], subPayIds: [] as string[],
};

interface Res { status: number; json: Record<string, unknown> | null; setCookie: string[]; }
async function http(method: string, path: string, opts: { cookie?: string } = {}): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
  });
  let json: Res["json"] = null;
  try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function post(path: string, body: unknown): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let json: Res["json"] = null;
  try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function login(email: string): Promise<string> {
  const r = await post("/api/v1/auth/login", { email, password: PW });
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}`);
  return cookie;
}
const dataOf = (r: Res) => (r.json?.data ?? {}) as Record<string, any>;
let mob = 200000000;
const nextMobile = () => `018${(mob++).toString().padStart(8, "0")}`;

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", label: string): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `arp-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id, email, fullName: `ARP ${label} ${RUN}`, mobile: nextMobile(), password: pwHash, role,
      status: "ACTIVE", ...(role === "OPERATION" ? { teacherApprovalState: "APPROVED" as const } : {}),
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let adminCookie: string, studentCookie: string, operationCookie: string;
let teacher: { id: string; email: string };
let chapterId: string, planId: string, subId: string;
let successCoursePayId: string, successSubPayId: string;
const COURSE_AMOUNT = 137;
const SUB_AMOUNT = 199;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN", "Admin");
  const student = await makeUser("STUDENT", "Student");
  const op = await makeUser("OPERATION", "Op");
  adminCookie = await login(admin.email);
  studentCookie = await login(student.email);
  operationCookie = await login(op.email);

  teacher = await makeUser("OPERATION", "Teacher");
  await makeUser("OPERATION", "FreeTeacher"); // approved, no sub, no payments → FREE, 0 revenue

  const stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `arp-stage-${RUN}`, sortOrder: 1, teacherId: teacher.id } });
  owned.stageIds.push(stageId);
  chapterId = randomUUID();
  await prisma.chapter.create({ data: { id: chapterId, name: `arp-chapter-${RUN}`, sortOrder: 1, stageId, price: COURSE_AMOUNT } });
  owned.chapterIds.push(chapterId);

  // Course payments: 1 SUCCESS (revenue), 1 PENDING, 1 FAILED — only SUCCESS counts.
  const s = await prisma.paymentTransaction.create({
    data: {
      studentId: student.id, chapterId, amount: COURSE_AMOUNT, currency: "EGP", status: "SUCCESS",
      paymobOrderId: `ARP-CRS-${RUN}-1`, paymobTransactionId: `ARP-CRS-TXN-${RUN}`,
      rawCallback: { hmac: "course-top-secret" },
    },
    select: { id: true },
  });
  successCoursePayId = s.id;
  owned.coursePayIds.push(s.id);
  for (const st of ["PENDING", "FAILED"] as const) {
    const p = await prisma.paymentTransaction.create({
      data: { studentId: student.id, chapterId, amount: COURSE_AMOUNT, currency: "EGP", status: st, paymobOrderId: `ARP-CRS-${RUN}-${st}` },
      select: { id: true },
    });
    owned.coursePayIds.push(p.id);
  }

  // Paid plan + ACTIVE subscription + SUCCESS/PENDING/FAILED subscription payments.
  const plan = await prisma.teacherPlan.create({
    data: { code: `ARP-${RUN}`, name: "arp", displayName: "ARP Plan", monthlyPrice: SUB_AMOUNT },
    select: { id: true },
  });
  planId = plan.id;
  owned.planIds.push(planId);
  const sub = await prisma.teacherSubscription.create({
    data: {
      teacherId: teacher.id, planId, status: "ACTIVE", billingInterval: "MONTHLY",
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    },
    select: { id: true },
  });
  subId = sub.id;
  owned.subscriptionIds.push(subId);
  const ssp = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: teacher.id, planId, subscriptionId: subId, provider: "PAYMOB", providerOrderId: `ARP-SUB-${RUN}-1`,
      amount: SUB_AMOUNT, currency: "EGP", billingInterval: "MONTHLY", status: "SUCCESS",
      checkoutUrl: "https://pay.example/sub-secret", rawCallback: { hmac: "sub-top-secret" },
    },
    select: { id: true },
  });
  successSubPayId = ssp.id;
  owned.subPayIds.push(ssp.id);
  for (const st of ["PENDING", "FAILED"] as const) {
    const p = await prisma.teacherSubscriptionPayment.create({
      data: { teacherId: teacher.id, planId, provider: "PAYMOB", providerOrderId: `ARP-SUB-${RUN}-${st}`, amount: SUB_AMOUNT, currency: "EGP", billingInterval: "MONTHLY", status: st },
      select: { id: true },
    });
    owned.subPayIds.push(p.id);
  }
});

afterAll(async () => {
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.coursePayIds } } });
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPayIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subscriptionIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("Admin Revenue & Payments — summary", () => {
  it("1. revenue summary returns the full shape", async () => {
    const r = await http("GET", "/api/admin/revenue/summary", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const d = dataOf(r);
    for (const k of [
      "confirmedCourseRevenue", "confirmedTeacherSubscriptionRevenue", "totalConfirmedRevenue",
      "monthlyConfirmedRevenue", "freeTeachersCount", "paidTeachersCount",
      "pendingCoursePayments", "failedCoursePayments", "pendingSubscriptionPayments", "failedSubscriptionPayments",
    ]) {
      expect(typeof d[k]).toBe("number");
    }
    expect(d.currency).toBe("EGP");
    expect(Array.isArray(d.reliabilityWarnings)).toBe(true);
  });

  it("6. total = course + subscription; pending/failed metrics include our fixtures", async () => {
    const d = dataOf(await http("GET", "/api/admin/revenue/summary", { cookie: adminCookie }));
    expect(d.totalConfirmedRevenue).toBe(d.confirmedCourseRevenue + d.confirmedTeacherSubscriptionRevenue);
    expect(d.pendingCoursePayments).toBeGreaterThanOrEqual(1);
    expect(d.failedCoursePayments).toBeGreaterThanOrEqual(1);
    expect(d.pendingSubscriptionPayments).toBeGreaterThanOrEqual(1);
    expect(d.failedSubscriptionPayments).toBeGreaterThanOrEqual(1);
    expect(d.paidTeachersCount).toBeGreaterThanOrEqual(1);
    expect(d.freeTeachersCount).toBeGreaterThanOrEqual(1);
  });
});

describe("Admin Revenue & Payments — rankings (deterministic, SUCCESS-only)", () => {
  it("2 & 5 & 8. by-chapter counts only SUCCESS (pending/failed excluded)", async () => {
    const r = await http("GET", "/api/admin/revenue/by-chapter?limit=100", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const row = (dataOf(r).data as any[]).find((x) => x.chapter.id === chapterId);
    expect(row).toBeTruthy();
    expect(row.confirmedRevenue).toBe(COURSE_AMOUNT); // not 3×
    expect(row.successfulPayments).toBe(1);
  });

  it("3 & 7. by-teacher: course + subscription revenue counted SUCCESS-only", async () => {
    const r = await http("GET", "/api/admin/revenue/by-teacher?limit=100", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const row = (dataOf(r).data as any[]).find((x) => x.teacher.id === teacher.id);
    expect(row).toBeTruthy();
    expect(row.courseRevenue).toBe(COURSE_AMOUNT);
    expect(row.successfulCoursePayments).toBe(1);
    expect(row.subscriptionRevenue).toBe(SUB_AMOUNT);
  });

  it("4. free teacher generates 0 revenue (absent from revenue rankings)", async () => {
    const r = await http("GET", "/api/admin/revenue/by-teacher?limit=100", { cookie: adminCookie });
    const rows = dataOf(r).data as any[];
    const freeTeacher = owned.userIds; // any ARP FreeTeacher has no payments
    const freeRow = rows.find((x) => x.teacher.fullName === `ARP FreeTeacher ${RUN}`);
    expect(freeRow).toBeUndefined();
    expect(freeTeacher.length).toBeGreaterThan(0);
  });
});

describe("Admin Revenue & Payments — payment lists & sanitisation", () => {
  it("9. course payments list (filtered by teacher) returns our 3 payments", async () => {
    const r = await http("GET", `/api/admin/payments/course?limit=100&teacherId=${teacher.id}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    expect((dataOf(r).data as any[]).length).toBe(3);
  });

  it("10. subscription payments list (filtered by teacher) returns our 3 payments", async () => {
    const r = await http("GET", `/api/admin/payments/subscriptions?limit=100&teacherId=${teacher.id}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    expect((dataOf(r).data as any[]).length).toBe(3);
  });

  it("11. payment details are sanitized (course + subscription)", async () => {
    const c = await http("GET", `/api/admin/payments/course/${successCoursePayId}`, { cookie: adminCookie });
    expect(c.status).toBe(200);
    expect(dataOf(c).status).toBe("SUCCESS");
    expect(dataOf(c).paidAt).toBeTruthy();
    expect(JSON.stringify(c.json)).not.toMatch(/rawCallback|paymobOrderId|paymobTransactionId|course-top-secret|ARP-CRS-/);

    const s = await http("GET", `/api/admin/payments/subscriptions/${successSubPayId}`, { cookie: adminCookie });
    expect(s.status).toBe(200);
    expect(JSON.stringify(s.json)).not.toMatch(/rawCallback|checkoutUrl|sub-top-secret|ARP-SUB-|providerOrderId/);
    expect(dataOf(s).provider).toBe("PAYMOB");
  });
});

describe("Admin Revenue & Payments — access control", () => {
  it("12. STUDENT denied (403)", async () => {
    expect((await http("GET", "/api/admin/revenue/summary", { cookie: studentCookie })).status).toBe(403);
  });
  it("13. OPERATION denied (403)", async () => {
    expect((await http("GET", "/api/admin/revenue/summary", { cookie: operationCookie })).status).toBe(403);
  });
  it("14. unauthenticated denied (401)", async () => {
    expect((await http("GET", "/api/admin/payments/course")).status).toBe(401);
  });
});
