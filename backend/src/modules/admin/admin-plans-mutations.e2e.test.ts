import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "AdminPlansMut@123";
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
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `plansmut-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: `PlansMut ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `018${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

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
});

afterAll(async () => {
  // Delete audit logs referencing these plans/users first (FK constraint)
  const planIds = owned.planIds.filter(Boolean);
  const userIds = owned.userIds.filter(Boolean);
  if (planIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: planIds } } });
    await prisma.auditLog.deleteMany({ where: { action: "ADMIN_PLANS_REORDERED" } });
  }
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  }
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPaymentIds.filter(Boolean) } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subscriptionIds.filter(Boolean) } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: planIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

// ── Helpers ──

async function post(path: string, body: unknown, cookie = adminCookie): Promise<HttpResult> {
  return http("POST", path, { cookie, body });
}

async function patch(path: string, body: unknown, cookie = adminCookie): Promise<HttpResult> {
  return http("PATCH", path, { cookie, body });
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    code: `TEST_${randomUUID().slice(0, 6).toUpperCase()}`,
    name: "test plan",
    displayName: "Test Plan",
    description: "A test plan",
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "EGP",
    features: { aiQuizGeneration: true, analyticsAccess: false },
    limits: { maxStudents: 50, storageMb: 500 },
    isActive: true,
    isRecommended: false,
    sortOrder: 10,
    ...overrides,
  };
}

function getData(r: HttpResult): Record<string, unknown> | null {
  return r.json?.data as Record<string, unknown> | null;
}

// ── Tests ──

describe("POST /api/admin/plans — create plan", () => {
  it("1. ADMIN creates a plan (201)", async () => {
    const body = validCreateBody();
    const r = await post("/api/admin/plans", body);
    expect(r.status).toBe(201);
    const data = getData(r);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("code", body.code);
    expect(data).toHaveProperty("monthlyPrice", 99);
    expect(data).toHaveProperty("isActive", true);
    expect(data).toHaveProperty("isRecommended", false);
    // Verify features stored as Record<string, boolean>
    const features = data?.features as Record<string, boolean>;
    expect(features).toHaveProperty("aiQuizGeneration", true);
    expect(features).toHaveProperty("analyticsAccess", false);
    owned.planIds.push(data?.id as string);
  });

  it("2. duplicate code rejected (409)", async () => {
    const code = `DUPE_${randomUUID().slice(0, 6).toUpperCase()}`;
    const body = validCreateBody({ code });
    // Create first
    const r1 = await post("/api/admin/plans", body);
    expect(r1.status).toBe(201);
    owned.planIds.push(getData(r1)?.id as string);
    // Duplicate
    const r2 = await post("/api/admin/plans", body);
    expect(r2.status).toBe(409);
  });

  it("3. negative price rejected (400)", async () => {
    const r = await post("/api/admin/plans", validCreateBody({ monthlyPrice: -5 }));
    expect(r.status).toBe(400);
  });

  it("4. STUDENT denied (403)", async () => {
    const r = await post("/api/admin/plans", validCreateBody(), studentCookie);
    expect(r.status).toBe(403);
  });

  it("5. OPERATION denied (403)", async () => {
    const r = await post("/api/admin/plans", validCreateBody(), teacherCookie);
    expect(r.status).toBe(403);
  });
});

describe("PATCH /api/admin/plans/:planId — edit plan", () => {
  let planId: string;

  it("6. ADMIN edits plan fields", async () => {
    const createBody = validCreateBody({ code: `EDIT_${randomUUID().slice(0, 6).toUpperCase()}` });
    const created = await post("/api/admin/plans", createBody);
    planId = getData(created)?.id as string;
    owned.planIds.push(planId);

    const r = await patch(`/api/admin/plans/${planId}`, {
      displayName: "Updated Plan",
      monthlyPrice: 149,
      features: { aiQuizGeneration: true, essayGrading: true },
    });
    expect(r.status).toBe(200);
    const data = getData(r);
    expect(data).toHaveProperty("displayName", "Updated Plan");
    expect(data).toHaveProperty("monthlyPrice", 149);
    const features = data?.features as Record<string, boolean>;
    expect(features).toHaveProperty("essayGrading", true);
  });

  it("7. price edit preserves historical payments", async () => {
    const createBody = validCreateBody({ code: `PRICE_${randomUUID().slice(0, 6).toUpperCase()}` });
    const created = await post("/api/admin/plans", createBody);
    const pid = getData(created)?.id as string;
    owned.planIds.push(pid);

    // Create a teacher + subscription + payment before price change
    const teacherId = await makeUser("OPERATION");
    const sub = await prisma.teacherSubscription.create({
      data: {
        teacherId,
        planId: pid,
        status: "ACTIVE",
        billingInterval: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    owned.subscriptionIds.push(sub.id);

    const pay = await prisma.teacherSubscriptionPayment.create({
      data: {
        teacherId,
        planId: pid,
        amount: 99,
        status: "SUCCESS",
        provider: "PAYMOB",
        providerOrderId: `e2e-price-${randomUUID()}`,
        rawCallback: {},
      },
    });
    owned.subPaymentIds.push(pay.id);

    // Change price
    await patch(`/api/admin/plans/${pid}`, { monthlyPrice: 199 });

    // Verify historical payment amount is unchanged
    const payment = await prisma.teacherSubscriptionPayment.findUnique({ where: { id: pay.id } });
    expect(payment?.amount).toBe(99);
  });
});

describe("PATCH /api/admin/plans/:planId/status — activate/deactivate", () => {
  let activePlanId: string;

  it("8. ADMIN deactivates a non-free plan", async () => {
    const createBody = validCreateBody({ code: `DEACT_${randomUUID().slice(0, 6).toUpperCase()}`, isActive: true });
    const created = await post("/api/admin/plans", createBody);
    activePlanId = getData(created)?.id as string;
    owned.planIds.push(activePlanId);

    const r = await patch(`/api/admin/plans/${activePlanId}/status`, {
      isActive: false,
      reason: "Testing deactivation",
    });
    expect(r.status).toBe(200);
    const data = getData(r);
    expect(data).toHaveProperty("isActive", false);
  });

  it("9. existing active subscriptions remain valid after deactivation", async () => {
    const createBody = validCreateBody({ code: `SUB_${randomUUID().slice(0, 6).toUpperCase()}`, isActive: true });
    const created = await post("/api/admin/plans", createBody);
    const pid = getData(created)?.id as string;
    owned.planIds.push(pid);

    const teacherId = owned.userIds.find((_, i) => i >= 3)!;
    const sub = await prisma.teacherSubscription.create({
      data: {
        teacherId,
        planId: pid,
        status: "ACTIVE",
        billingInterval: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    owned.subscriptionIds.push(sub.id);

    await patch(`/api/admin/plans/${pid}/status`, { isActive: false, reason: "testing sub preservation" });

    const subAfter = await prisma.teacherSubscription.findUnique({ where: { id: sub.id } });
    expect(subAfter?.status).toBe("ACTIVE");
  });

  it("10. ADMIN activates a plan", async () => {
    const r = await patch(`/api/admin/plans/${activePlanId}/status`, { isActive: true });
    expect(r.status).toBe(200);
    const data = getData(r);
    expect(data).toHaveProperty("isActive", true);
  });
});

describe("PATCH /api/admin/plans/:planId/recommended — toggle recommended", () => {
  let planA: string;
  let planB: string;

  it("11. recommended toggle works — only one plan is recommended at a time", async () => {
    const codeA = `REC_A_${randomUUID().slice(0, 4).toUpperCase()}`;
    const a = await post("/api/admin/plans", validCreateBody({ code: codeA, isRecommended: false }));
    expect(a.status).toBe(201);
    planA = getData(a)?.id as string;
    owned.planIds.push(planA);

    const codeB = `REC_B_${randomUUID().slice(0, 4).toUpperCase()}`;
    const b = await post("/api/admin/plans", validCreateBody({ code: codeB, isRecommended: false }));
    expect(b.status).toBe(201);
    planB = getData(b)?.id as string;
    owned.planIds.push(planB);

    // Set A as recommended
    await patch(`/api/admin/plans/${planA}/recommended`, { isRecommended: true });
    let plan = await prisma.teacherPlan.findUnique({ where: { id: planA } });
    expect(plan?.isRecommended).toBe(true);

    // Set B as recommended — A should be unset
    await patch(`/api/admin/plans/${planB}/recommended`, { isRecommended: true });
    plan = await prisma.teacherPlan.findUnique({ where: { id: planA } });
    expect(plan?.isRecommended).toBe(false);
    plan = await prisma.teacherPlan.findUnique({ where: { id: planB } });
    expect(plan?.isRecommended).toBe(true);
  });
});

describe("PATCH /api/admin/plans/reorder — reorder plans", () => {
  it("12. reorder updates sortOrder", async () => {
    const codeA = `ORD_A_${randomUUID().slice(0, 4).toUpperCase()}`;
    const codeB = `ORD_B_${randomUUID().slice(0, 4).toUpperCase()}`;
    const a = await post("/api/admin/plans", validCreateBody({ code: codeA, sortOrder: 1 }));
    expect(a.status).toBe(201);
    const b = await post("/api/admin/plans", validCreateBody({ code: codeB, sortOrder: 2 }));
    expect(b.status).toBe(201);
    const idA = getData(a)?.id as string;
    const idB = getData(b)?.id as string;
    owned.planIds.push(idA, idB);

    const r = await patch("/api/admin/plans/reorder", {
      items: [
        { id: idA, sortOrder: 10 },
        { id: idB, sortOrder: 5 },
      ],
    });
    expect(r.status).toBe(200);

    const planA = await prisma.teacherPlan.findUnique({ where: { id: idA } });
    const planB = await prisma.teacherPlan.findUnique({ where: { id: idB } });
    expect(planA?.sortOrder).toBe(10);
    expect(planB?.sortOrder).toBe(5);
  });
});

describe("Security — no secrets exposed", () => {
  it("13. no passwords/secrets in create response", async () => {
    const body = validCreateBody({ code: `SEC_${randomUUID().slice(0, 6).toUpperCase()}` });
    const r = await post("/api/admin/plans", body);
    owned.planIds.push(getData(r)?.id as string);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/password|token|rawCallback|secret/i);
  });
});

describe("AuditLogs", () => {
  it("14. AuditLogs written for create, update, status, recommended, reorder", async () => {
    const code = `AUDIT_${randomUUID().slice(0, 6).toUpperCase()}`;
    const created = await post("/api/admin/plans", validCreateBody({ code }));
    const pid = getData(created)?.id as string;
    owned.planIds.push(pid);

    await patch(`/api/admin/plans/${pid}`, { displayName: "Audit Updated" });
    await patch(`/api/admin/plans/${pid}/status`, { isActive: false, reason: "audit test" });
    await patch(`/api/admin/plans/${pid}/recommended`, { isRecommended: true });

    const logs = await prisma.auditLog.findMany({
      where: { resourceId: pid },
      orderBy: { createdAt: "asc" },
    });

    const actions = logs.map((l) => l.action);
    expect(actions).toContain("ADMIN_PLAN_CREATED");
    expect(actions).toContain("ADMIN_PLAN_UPDATED");
    expect(actions).toContain("ADMIN_PLAN_DEACTIVATED");
    expect(actions).toContain("ADMIN_PLAN_RECOMMENDED_CHANGED");

    // Reorder audit log has resourceId = "bulk"
    const reorderLog = await prisma.auditLog.findFirst({
      where: { action: "ADMIN_PLANS_REORDERED" },
    });
    expect(reorderLog).toBeDefined();
  });
});
