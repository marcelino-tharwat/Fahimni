import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the Admin Subscriptions Review module. Isolated test DB, self-owned
 * fixtures (unique run token), torn down afterwards. Verifies the FREE-plan
 * entitlement policy, revenue counting, payment sanitisation, manual-request
 * review safety, AI-usage aggregation, and ADMIN-only access.
 */

let server: Server;
let base: string;
const PW = "AdminSubs@123";
const RUN = randomUUID().slice(0, 8);
let pwHash: string;

const owned = {
  userIds: [] as string[],
  planIds: [] as string[],
  subscriptionIds: [] as string[],
  paymentIds: [] as string[],
  requestIds: [] as string[],
};

interface Res { status: number; json: Record<string, unknown> | null; setCookie: string[]; }
async function http(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: Res["json"] = null;
  try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}
const dataOf = (r: Res) => (r.json?.data ?? {}) as Record<string, unknown>;
let mob = 100000000;
const nextMobile = () => `017${(mob++).toString().padStart(8, "0")}`;

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", label: string): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `asr-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id, email, fullName: `ASR ${label} ${RUN}`, mobile: nextMobile(), password: pwHash, role,
      status: "ACTIVE",
      ...(role === "OPERATION" ? { teacherApprovalState: "APPROVED" as const } : {}),
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let adminCookie: string, studentCookie: string, operationCookie: string;
let planId: string, planCode: string;
let tFree: { id: string; email: string };
let tPaid: { id: string; email: string };
let tPending: { id: string; email: string };
let tFailed: { id: string; email: string };
let paidSubId: string;
let pendingRequestId: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN", "Admin");
  const student = await makeUser("STUDENT", "Student");
  const operation = await makeUser("OPERATION", "Op");
  adminCookie = await login(admin.email);
  studentCookie = await login(student.email);
  operationCookie = await login(operation.email);

  // A dedicated paid plan (so we own + clean it up).
  const plan = await prisma.teacherPlan.create({
    data: { code: `ASR-${RUN}`, name: "asr", displayName: "ASR Paid Plan", monthlyPrice: 199 },
    select: { id: true, code: true },
  });
  planId = plan.id;
  planCode = plan.code;
  owned.planIds.push(planId);

  tFree = await makeUser("OPERATION", "Free");
  tPaid = await makeUser("OPERATION", "Paid");
  tPending = await makeUser("OPERATION", "Pending");
  tFailed = await makeUser("OPERATION", "Failed");

  // Paid teacher: ACTIVE, non-lapsed subscription + a SUCCESS payment (revenue).
  const sub = await prisma.teacherSubscription.create({
    data: {
      teacherId: tPaid.id, planId, status: "ACTIVE", billingInterval: "MONTHLY",
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    },
    select: { id: true },
  });
  paidSubId = sub.id;
  owned.subscriptionIds.push(paidSubId);

  const successPay = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: tPaid.id, planId, subscriptionId: paidSubId, provider: "PAYMOB",
      providerOrderId: `ASR-ORD-${RUN}-1`, providerTransactionId: `ASR-TXN-${RUN}-1`,
      amount: 199, currency: "EGP", billingInterval: "MONTHLY", status: "SUCCESS",
      // Secrets that must NEVER surface in the admin API responses.
      checkoutUrl: "https://pay.example/checkout/secret", rawCallback: { hmac: "top-secret", raw: "x" },
    },
    select: { id: true },
  });
  owned.paymentIds.push(successPay.id);

  // Pending-payment teacher (must stay FREE, not upgraded).
  const pendingPay = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: tPending.id, planId, provider: "PAYMOB", providerOrderId: `ASR-ORD-${RUN}-2`,
      amount: 199, currency: "EGP", billingInterval: "MONTHLY", status: "PENDING",
      checkoutUrl: "https://pay.example/checkout/pending", rawCallback: { secret: "no" },
    },
    select: { id: true },
  });
  owned.paymentIds.push(pendingPay.id);

  // Failed-payment teacher (must stay FREE).
  const failedPay = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: tFailed.id, planId, provider: "PAYMOB", providerOrderId: `ASR-ORD-${RUN}-3`,
      amount: 199, currency: "EGP", billingInterval: "MONTHLY", status: "FAILED",
      errorMessage: "insufficient funds",
    },
    select: { id: true },
  });
  owned.paymentIds.push(failedPay.id);

  // A PENDING manual subscription request (for approve/reject).
  const req = await prisma.teacherSubscriptionRequest.create({
    data: { teacherId: tFree.id, planId, requestedInterval: "MONTHLY", status: "PENDING" },
    select: { id: true },
  });
  pendingRequestId = req.id;
  owned.requestIds.push(pendingRequestId);

  // AI usage events for the paid teacher.
  await prisma.teacherAiUsageEvent.createMany({
    data: [
      { teacherId: tPaid.id, planId, usageType: "AI_QUIZ_GENERATION", units: 3 },
      { teacherId: tPaid.id, planId, usageType: "AI_ESSAY_GRADING", units: 2 },
    ],
  });
});

afterAll(async () => {
  await prisma.teacherAiUsageEvent.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscriptionRequest.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

const Q = `&q=${RUN}`; // scope list results to this run's teachers (RUN is in each fullName)

describe("Admin Subscriptions Review — entitlements", () => {
  it("1 & 2. lists entitlements; approved free teacher = DEFAULT_FREE_PLAN / FREE", async () => {
    const r = await http("GET", `/api/admin/teacher-entitlements?limit=100${Q}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as Array<Record<string, any>>;
    const free = rows.find((x) => x.teacher.id === tFree.id);
    expect(free).toBeTruthy();
    expect(free!.entitlementSource).toBe("DEFAULT_FREE_PLAN");
    expect(free!.currentPlan.code).toBe("FREE");
    expect(free!.activeSubscription).toBeNull();
  });

  it("3. active paid teacher = ACTIVE_SUBSCRIPTION with revenue from SUCCESS payment", async () => {
    const r = await http("GET", `/api/admin/teacher-entitlements?limit=100${Q}`, { cookie: adminCookie });
    const rows = dataOf(r).data as Array<Record<string, any>>;
    const paid = rows.find((x) => x.teacher.id === tPaid.id)!;
    expect(paid.entitlementSource).toBe("ACTIVE_SUBSCRIPTION");
    expect(paid.currentPlan.code).toBe(planCode);
    expect(paid.confirmedSubscriptionRevenue).toBe(199);
    expect(paid.successfulPaymentsCount).toBe(1);
  });

  it("4. pending-payment teacher remains FREE (not upgraded)", async () => {
    const r = await http("GET", `/api/admin/teacher-entitlements?limit=100${Q}`, { cookie: adminCookie });
    const rows = dataOf(r).data as Array<Record<string, any>>;
    const p = rows.find((x) => x.teacher.id === tPending.id)!;
    expect(p.entitlementSource).toBe("DEFAULT_FREE_PLAN");
    expect(p.currentPlan.code).toBe("FREE");
    expect(p.pendingPayment).not.toBeNull();
    expect(p.confirmedSubscriptionRevenue).toBe(0);
  });

  it("5. failed-payment teacher remains FREE", async () => {
    const r = await http("GET", `/api/admin/teacher-entitlements?limit=100${Q}`, { cookie: adminCookie });
    const rows = dataOf(r).data as Array<Record<string, any>>;
    const f = rows.find((x) => x.teacher.id === tFailed.id)!;
    expect(f.entitlementSource).toBe("DEFAULT_FREE_PLAN");
    expect(f.failedPaymentsCount).toBe(1);
    expect(f.confirmedSubscriptionRevenue).toBe(0);
  });
});

describe("Admin Subscriptions Review — subscriptions & payments", () => {
  it("6. lists subscriptions", async () => {
    const r = await http("GET", `/api/admin/teacher-subscriptions?limit=100${Q}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as Array<Record<string, any>>;
    expect(rows.some((s) => s.id === paidSubId)).toBe(true);
  });

  it("7. views subscription detail with sanitized payments", async () => {
    const r = await http("GET", `/api/admin/teacher-subscriptions/${paidSubId}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const d = dataOf(r);
    expect(d.id).toBe(paidSubId);
    expect((d.payments as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r.json)).not.toMatch(/rawCallback|checkoutUrl|top-secret|ASR-ORD-|ASR-TXN-/);
  });

  it("8. lists payments", async () => {
    const r = await http("GET", `/api/admin/teacher-subscription-payments?limit=100${Q}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as Array<Record<string, any>>;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const success = rows.find((p) => p.status === "SUCCESS");
    expect(success!.paidAt).toBeTruthy();
  });

  it("9 & 16. payment detail is sanitized (no rawCallback/checkoutUrl/secret/provider ids)", async () => {
    const r = await http("GET", `/api/admin/teacher-subscription-payments?limit=100${Q}`, { cookie: adminCookie });
    const first = (dataOf(r).data as Array<Record<string, any>>)[0]!;
    const detail = await http("GET", `/api/admin/teacher-subscription-payments/${first.id}`, { cookie: adminCookie });
    expect(detail.status).toBe(200);
    const raw = JSON.stringify(detail.json);
    expect(raw).not.toMatch(/rawCallback|checkoutUrl|top-secret|ASR-ORD-|ASR-TXN-|hmac/);
    expect(dataOf(detail).provider).toBe("PAYMOB");
  });
});

describe("Admin Subscriptions Review — manual requests", () => {
  it("10. lists manual requests", async () => {
    const r = await http("GET", `/api/admin/teacher-subscription-requests?limit=100${Q}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as Array<Record<string, any>>;
    expect(rows.some((x) => x.id === pendingRequestId)).toBe(true);
  });

  it("11. approve is safe — APPROVED + policy-pending, NO fake subscription/SUCCESS payment created", async () => {
    const subsBefore = await prisma.teacherSubscription.count({ where: { teacherId: tFree.id } });
    const paysBefore = await prisma.teacherSubscriptionPayment.count({ where: { teacherId: tFree.id } });

    const r = await http("PATCH", `/api/admin/teacher-subscription-requests/${pendingRequestId}/approve`, {
      cookie: adminCookie, body: { adminNotes: "ok" },
    });
    expect(r.status).toBe(200);
    expect(dataOf(r).activation).toBe("MANUAL_SUBSCRIPTION_ACTIVATION_POLICY_PENDING");
    expect((dataOf(r).request as Record<string, unknown>).status).toBe("APPROVED");

    // No fabricated subscription / payment.
    expect(await prisma.teacherSubscription.count({ where: { teacherId: tFree.id } })).toBe(subsBefore);
    expect(await prisma.teacherSubscriptionPayment.count({ where: { teacherId: tFree.id } })).toBe(paysBefore);
    // AuditLog written.
    const log = await prisma.auditLog.findFirst({
      where: { resourceId: pendingRequestId, action: "TEACHER_SUBSCRIPTION_REQUEST_APPROVED" },
    });
    expect(log).not.toBeNull();
  });

  it("11b. reject marks REJECTED, keeps the row, writes AuditLog", async () => {
    const req = await prisma.teacherSubscriptionRequest.create({
      data: { teacherId: tFailed.id, planId, requestedInterval: "MONTHLY", status: "PENDING" },
      select: { id: true },
    });
    owned.requestIds.push(req.id);

    const r = await http("PATCH", `/api/admin/teacher-subscription-requests/${req.id}/reject`, {
      cookie: adminCookie, body: { adminNotes: "not eligible" },
    });
    expect(r.status).toBe(200);
    expect((dataOf(r).request as Record<string, unknown>).status).toBe("REJECTED");

    const still = await prisma.teacherSubscriptionRequest.findUnique({ where: { id: req.id } });
    expect(still?.status).toBe("REJECTED"); // not deleted
    const log = await prisma.auditLog.findFirst({
      where: { resourceId: req.id, action: "TEACHER_SUBSCRIPTION_REQUEST_REJECTED" },
    });
    expect(log).not.toBeNull();
  });
});

describe("Admin Subscriptions Review — AI usage", () => {
  it("12. aggregates AI usage per teacher", async () => {
    const r = await http("GET", `/api/admin/ai-usage?limit=100${Q}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as Array<Record<string, any>>;
    const paid = rows.find((x) => x.teacher.id === tPaid.id)!;
    expect(paid.totalUnits).toBe(5);
    expect(paid.totalEvents).toBe(2);
    expect(paid.byType.AI_QUIZ_GENERATION).toBe(3);
    expect(paid.byType.AI_ESSAY_GRADING).toBe(2);
    expect((dataOf(r).totals as Record<string, unknown>).totalUnits).toBeGreaterThanOrEqual(5);
  });
});

describe("Admin Subscriptions Review — access control", () => {
  it("13. STUDENT is denied (403)", async () => {
    expect((await http("GET", "/api/admin/teacher-entitlements", { cookie: studentCookie })).status).toBe(403);
  });
  it("14. OPERATION is denied (403)", async () => {
    expect((await http("GET", "/api/admin/teacher-entitlements", { cookie: operationCookie })).status).toBe(403);
  });
  it("15. unauthenticated is denied (401)", async () => {
    expect((await http("GET", "/api/admin/teacher-entitlements")).status).toBe(401);
  });
});
