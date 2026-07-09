import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "AdminPlans@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  planIds: [] as string[],
  subscriptionIds: [] as string[],
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

async function makeUser(
  role: "ADMIN" | "OPERATION" | "STUDENT",
  fullName?: string,
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `plan-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: fullName ?? `Plan ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `017${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makePlan(
  code: string,
  overrides: Partial<{
    monthlyPrice: number;
    yearlyPrice: number | null;
    isActive: boolean;
    isRecommended: boolean;
    sortOrder: number;
  }> = {},
): Promise<string> {
  const plan = await prisma.teacherPlan.create({
    data: {
      code,
      name: code.toLowerCase(),
      displayName: `Plan ${code}`,
      description: `Description for ${code}`,
      monthlyPrice: overrides.monthlyPrice ?? 0,
      yearlyPrice: overrides.yearlyPrice ?? null,
      currency: "EGP",
      billingInterval: "MONTHLY",
      isActive: overrides.isActive ?? true,
      isRecommended: overrides.isRecommended ?? false,
      sortOrder: overrides.sortOrder ?? 0,
      features: [],
      limits: {},
    },
  });
  owned.planIds.push(plan.id);
  return plan.id;
}

async function subscribe(teacherId: string, planId: string, status: "ACTIVE" | "TRIALING" | "EXPIRED") {
  const sub = await prisma.teacherSubscription.create({
    data: {
      teacherId,
      planId,
      status,
      billingInterval: "MONTHLY",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  owned.subscriptionIds.push(sub.id);
  return sub.id;
}

async function subPayment(
  teacherId: string,
  planId: string,
  amount: number,
  status: "SUCCESS" | "PENDING" | "FAILED",
) {
  const p = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId,
      planId,
      amount,
      status,
      provider: "PAYMOB",
      providerOrderId: `plan-e2e-${randomUUID()}`,
      rawCallback: { secret: "should-never-be-exposed" },
    },
  });
  owned.subPaymentIds.push(p.id);
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

let freePlanId: string;
let basicPlanId: string;
let proPlanId: string;
let inactivePlanId: string;
let teacherA: string;
let teacherB: string;

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

  // Plans
  freePlanId = await makePlan("FREE", { monthlyPrice: 0, sortOrder: 0 });
  basicPlanId = await makePlan("BASIC", { monthlyPrice: 199, yearlyPrice: 1990, sortOrder: 1 });
  proPlanId = await makePlan("PRO", { monthlyPrice: 499, yearlyPrice: 4990, sortOrder: 2, isRecommended: true });
  inactivePlanId = await makePlan("INACTIVE_PLAN", { monthlyPrice: 99, isActive: false, sortOrder: 99 });

  // Teachers
  teacherA = await makeUser("OPERATION", "Alice Plan User");
  teacherB = await makeUser("OPERATION", "Bob Plan User");

  // Teacher A has active PRO subscription + successful payment
  await subscribe(teacherA, proPlanId, "ACTIVE");
  await subPayment(teacherA, proPlanId, 499, "SUCCESS");

  // Teacher B has active BASIC subscription + pending payment
  await subscribe(teacherB, basicPlanId, "ACTIVE");
  await subPayment(teacherB, basicPlanId, 199, "PENDING");
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPaymentIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subscriptionIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

type PlanItem = {
  id: string;
  code: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: Record<string, boolean>;
  limits: Record<string, unknown>;
  stats: {
    freeEntitlementsCount: number;
    activePaidSubscriptionsCount: number;
    pendingPaymentsCount: number;
    successfulPaymentsCount: number;
    confirmedRevenue: number;
  };
  createdAt: string;
  updatedAt: string;
};

type ListResult = {
  data: PlanItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function list(query = "", cookie = adminCookie): Promise<HttpResult> {
  return http("GET", `/api/admin/plans${query}`, { cookie });
}

async function listData(query = ""): Promise<ListResult> {
  return (await list(query)).json?.data as ListResult;
}

async function getDetail(planId: string, cookie = adminCookie): Promise<HttpResult> {
  return http("GET", `/api/admin/plans/${planId}`, { cookie });
}

describe("GET /api/admin/plans — authorization", () => {
  it("1. allows ADMIN (200)", async () => {
    expect((await list()).status).toBe(200);
  });

  it("2. rejects unauthenticated (401)", async () => {
    expect((await http("GET", "/api/admin/plans")).status).toBe(401);
  });

  it("3. rejects OPERATION/teacher (403)", async () => {
    expect((await list("", teacherCookie)).status).toBe(403);
  });

  it("4. rejects STUDENT (403)", async () => {
    expect((await list("", studentCookie)).status).toBe(403);
  });
});

describe("GET /api/admin/plans — list & filters", () => {
  it("5. free plan appears in the list", async () => {
    const d = await listData("?limit=100");
    const free = d.data.find((p) => p.code === "FREE");
    expect(free).toBeDefined();
    expect(free!.monthlyPrice).toBe(0);
  });

  it("6. can search plans by q (name/code)", async () => {
    const d = await listData(`?q=${encodeURIComponent("BASIC")}`);
    expect(d.data.length).toBe(1);
    expect(d.data[0]!.code).toBe("BASIC");
  });

  it("7. can filter active plans", async () => {
    const d = await listData("?isActive=true&limit=100");
    expect(d.data.every((p) => p.isActive)).toBe(true);
  });

  it("8. can filter inactive plans", async () => {
    const d = await listData("?isActive=false&limit=100");
    expect(d.data.length).toBeGreaterThanOrEqual(1);
    expect(d.data.every((p) => !p.isActive)).toBe(true);
  });

  it("9. pagination works", async () => {
    const page1 = await listData("?page=1&limit=2");
    expect(page1.data.length).toBeLessThanOrEqual(2);
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.total).toBeGreaterThanOrEqual(4);
  });

  it("10. sorts by sortOrder asc by default", async () => {
    const d = await listData("?limit=100");
    for (let i = 1; i < d.data.length; i++) {
      expect(d.data[i]!.sortOrder).toBeGreaterThanOrEqual(d.data[i - 1]!.sortOrder);
    }
  });
});

describe("GET /api/admin/plans — stats", () => {
  it("11. free plan stats — revenue is 0", async () => {
    const d = await listData("?limit=100");
    const free = d.data.find((p) => p.code === "FREE")!;
    expect(free.stats.confirmedRevenue).toBe(0);
    expect(free.stats.freeEntitlementsCount).toBeGreaterThanOrEqual(2); // both teachers w/o paid sub on FREE
  });

  it("12. pro plan stats — has active subscription and payment", async () => {
    const d = await listData("?limit=100");
    const pro = d.data.find((p) => p.code === "PRO")!;
    expect(pro.stats.activePaidSubscriptionsCount).toBeGreaterThanOrEqual(1);
    expect(pro.stats.successfulPaymentsCount).toBeGreaterThanOrEqual(1);
    expect(pro.stats.confirmedRevenue).toBeGreaterThanOrEqual(499);
    expect(pro.stats.pendingPaymentsCount).toBe(0);
  });

  it("13. basic plan stats — has pending payment", async () => {
    const d = await listData("?limit=100");
    const basic = d.data.find((p) => p.code === "BASIC")!;
    expect(basic.stats.pendingPaymentsCount).toBeGreaterThanOrEqual(1);
  });

  it("14. all stat fields are safe numbers (no NaN/undefined)", async () => {
    const d = await listData("?limit=100");
    for (const plan of d.data) {
      const s = plan.stats;
      expect(typeof s.freeEntitlementsCount).toBe("number");
      expect(typeof s.activePaidSubscriptionsCount).toBe("number");
      expect(typeof s.pendingPaymentsCount).toBe("number");
      expect(typeof s.successfulPaymentsCount).toBe("number");
      expect(typeof s.confirmedRevenue).toBe("number");
      expect([s.freeEntitlementsCount, s.activePaidSubscriptionsCount, s.pendingPaymentsCount, s.successfulPaymentsCount, s.confirmedRevenue]).not.toContain(NaN);
    }
  });
});

describe("GET /api/admin/plans/:planId — detail", () => {
  it("15. returns plan detail for valid plan", async () => {
    const r = await getDetail(proPlanId);
    expect(r.status).toBe(200);
    const detail = r.json?.data as Record<string, unknown>;
    expect(detail).toBeDefined();
    expect(detail).toHaveProperty("code", "PRO");
    expect(detail).toHaveProperty("features");
    expect(detail).toHaveProperty("limits");
    expect(detail).toHaveProperty("stats");
  });

  it("16. returns 404 for non-existent plan", async () => {
    const r = await getDetail(randomUUID());
    expect(r.status).toBe(404);
  });

  it("17. includes teachers using the plan", async () => {
    const r = await getDetail(proPlanId);
    const detail = r.json?.data as Record<string, unknown>;
    const teachers = detail?.teachers as Array<Record<string, unknown>>;
    expect(teachers.length).toBeGreaterThanOrEqual(1);
    expect(teachers[0]).toHaveProperty("fullName");
    expect(teachers[0]).toHaveProperty("email");
  });

  it("18. includes recent payments (safe fields only)", async () => {
    const r = await getDetail(proPlanId);
    const detail = r.json?.data as Record<string, unknown>;
    const payments = detail?.recentPayments as Array<Record<string, unknown>>;
    expect(payments.length).toBeGreaterThanOrEqual(1);
    const payment = payments[0] as Record<string, unknown>;
    expect(payment).toHaveProperty("id");
    expect(payment).toHaveProperty("teacherName");
    expect(payment).toHaveProperty("amount");
    expect(payment).toHaveProperty("status");
    expect(payment).toHaveProperty("createdAt");
  });
});

describe("GET /api/admin/plans — security", () => {
  it("19. no raw payment/provider secrets exposed in list", async () => {
    const r = await list("?limit=100");
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(
      /password|tokenVersion|rawCallback|providerOrderId|providerTransactionId|checkoutUrl|should-never-be-exposed/i,
    );
  });

  it("20. no raw payment/provider secrets exposed in detail", async () => {
    const r = await getDetail(proPlanId);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(
      /password|tokenVersion|rawCallback|providerOrderId|providerTransactionId|checkoutUrl|should-never-be-exposed/i,
    );
  });
});
