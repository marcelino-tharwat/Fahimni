import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

// Mock Paymob so checkout never touches the network. Replaces the provider for
// both student and teacher payment paths. Order ids are unique per call to
// respect the providerOrderId unique constraint.
vi.mock("../payment/paymob.service.js", () => ({
  PaymobService: class {
    async getValidToken() {
      return "e2e-token";
    }
    async createOrder() {
      return `e2e-order-${randomUUID()}`;
    }
    async getPaymentKey() {
      return "e2e-payment-key";
    }
    buildIframeUrl(key: string) {
      return `https://pay.test/iframe/${key}`;
    }
  },
}));

const { createApp } = await import("../../app.js");
const { prisma } = await import("../../config/database.js");
const { TEACHER_PLANS } = await import("./teacher-plan.seed-data.js");

let server: Server;
let base: string;
const PW = "Checkout@E2E123";
let pwHash: string;

const owned = { userIds: [] as string[] };

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

async function seedUser(role: "OPERATION" | "STUDENT"): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `co-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: `Checkout ${role}`,
      mobile: `017${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

let teacherId: string;
let studentId: string;
let teacherCookie: string;
let studentCookie: string;
let basicPlanId: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  for (const plan of TEACHER_PLANS) {
    await prisma.teacherPlan.upsert({
      where: { code: plan.code },
      update: { isActive: plan.isActive, monthlyPrice: plan.monthlyPrice },
      create: {
        code: plan.code,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
    });
  }
  basicPlanId = (await prisma.teacherPlan.findUniqueOrThrow({ where: { code: "BASIC" } })).id;

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  teacherId = await seedUser("OPERATION");
  studentId = await seedUser("STUDENT");
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherId } })).email);
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).email);
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("Teacher subscription checkout — routes & authorization", () => {
  it("OPERATION can fetch plans", async () => {
    const r = await http("GET", "/api/teacher/plans", { cookie: teacherCookie });
    expect(r.status).toBe(200);
    expect(Array.isArray((r.json as { plans: unknown[] }).plans)).toBe(true);
  });

  it("OPERATION can fetch current subscription (defaults to FREE)", async () => {
    const r = await http("GET", "/api/teacher/subscription/me", { cookie: teacherCookie });
    expect(r.status).toBe(200);
    expect(r.json?.effectivePlanCode).toBe("FREE");
    expect(r.json).toHaveProperty("pendingPayment");
  });

  it("rejects unauthenticated checkout (401)", async () => {
    const r = await http("POST", "/api/teacher/subscription/checkout", {
      body: { planId: basicPlanId, billingInterval: "MONTHLY" },
    });
    expect(r.status).toBe(401);
  });

  it("rejects STUDENT checkout (403)", async () => {
    const r = await http("POST", "/api/teacher/subscription/checkout", {
      cookie: studentCookie,
      body: { planId: basicPlanId, billingInterval: "MONTHLY" },
    });
    expect(r.status).toBe(403);
  });

  it("OPERATION checkout returns a checkoutUrl, creates a PENDING payment, activates nothing", async () => {
    const r = await http("POST", "/api/teacher/subscription/checkout", {
      cookie: teacherCookie,
      body: { planId: basicPlanId, billingInterval: "MONTHLY" },
    });
    expect(r.status).toBe(201);
    expect(typeof r.json?.checkoutUrl).toBe("string");
    expect((r.json?.checkoutUrl as string).length).toBeGreaterThan(0);
    expect(r.json?.status).toBe("PENDING");
    // Backend price only (BASIC = 199).
    expect(r.json?.amount).toBe(199);
    // No provider secrets / raw callback in the response.
    expect(r.json).not.toHaveProperty("rawCallback");

    const payment = await prisma.teacherSubscriptionPayment.findFirstOrThrow({
      where: { teacherId },
    });
    expect(payment.status).toBe("PENDING");

    const sub = await prisma.teacherSubscription.findFirst({ where: { teacherId } });
    expect(sub).toBeNull();
  });

  it("surfaces the pending payment on /subscription/me without rawCallback", async () => {
    const r = await http("GET", "/api/teacher/subscription/me", { cookie: teacherCookie });
    expect(r.status).toBe(200);
    const pending = r.json?.pendingPayment as Record<string, unknown> | null;
    expect(pending).not.toBeNull();
    expect(pending).not.toHaveProperty("rawCallback");
    expect(pending?.status).toBe("PENDING");
    // Still FREE until the payment is confirmed.
    expect(r.json?.effectivePlanCode).toBe("FREE");
  });
});
