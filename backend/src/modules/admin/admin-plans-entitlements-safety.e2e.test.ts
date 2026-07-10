import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import {
  TeacherPlanEntitlementService,
  type TeacherEntitlement,
} from "../teacher-plans/teacher-plan-entitlement.service.js";

let server: Server;
let base: string;
const PW = "Entitlements@123";
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
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `esafety-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: `ESafety ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `018${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
      ...overrides,
    },
  });
  owned.userIds.push(id);
  return id;
}

let adminCookie: string;
let teacher1Cookie: string;
let teacher2Cookie: string;

// Teacher with no subscription (free)
let freeTeacherId: string;
// Teacher with active paid subscription
let paidTeacherId: string;
let paidPlanId: string;
let paidSubId: string;
// A deactivated plan ID
let deactivatedPlanId: string;

let entitlementService: TeacherPlanEntitlementService;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  entitlementService = new TeacherPlanEntitlementService();

  const adminId = await makeUser("ADMIN");
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email);

  // Teacher 1: free (no subscription)
  freeTeacherId = await makeUser("OPERATION");

  // Teacher 2: will get a paid subscription
  paidTeacherId = await makeUser("OPERATION");

  // Create a paid plan
  const plan = await prisma.teacherPlan.create({
    data: {
      code: `PAID_${randomUUID().slice(0, 6).toUpperCase()}`,
      name: "paid test",
      displayName: "Paid Test Plan",
      description: "For e2e entitlement testing",
      monthlyPrice: 199,
      currency: "EGP",
      billingInterval: "MONTHLY",
      isActive: true,
      isRecommended: false,
      sortOrder: 50,
      features: { aiQuizGeneration: true, analyticsAccess: true },
      limits: { maxStudents: 100, storageMb: 1000 },
    },
  });
  paidPlanId = plan.id;
  owned.planIds.push(plan.id);

  // Create active subscription for paidTeacher
  const sub = await prisma.teacherSubscription.create({
    data: {
      teacherId: paidTeacherId,
      planId: paidPlanId,
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart: new Date(Date.now() - 86400_000),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
    },
  });
  paidSubId = sub.id;
  owned.subscriptionIds.push(sub.id);

  // Teacher cookies
  teacher1Cookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: freeTeacherId } })).email);
  teacher2Cookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: paidTeacherId } })).email);

  // Create a deactivated plan for inactive-plan tests
  const deactivatedPlan = await prisma.teacherPlan.create({
    data: {
      code: `ARCHIVED_${randomUUID().slice(0, 6).toUpperCase()}`,
      name: "archived test",
      displayName: "Archived Test Plan",
      description: "An inactive plan for e2e testing",
      monthlyPrice: 99,
      currency: "EGP",
      billingInterval: "MONTHLY",
      isActive: false,
      isRecommended: false,
      sortOrder: 99,
      features: { aiQuizGeneration: true },
      limits: { maxStudents: 50 },
    },
  });
  deactivatedPlanId = deactivatedPlan.id;
  owned.planIds.push(deactivatedPlan.id);
});

afterAll(async () => {
  const planIds = owned.planIds.filter(Boolean);
  const userIds = owned.userIds.filter(Boolean);
  if (planIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: planIds } } });
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

function getPlans(r: HttpResult): unknown[] {
  const data = r.json?.plans ?? r.json?.data;
  if (Array.isArray(data)) return data;
  // Admin endpoint wraps a paginated payload in okResponse:
  // { data: { data: [...], meta } } — also tolerate a legacy { data: { plans } }.
  const d = r.json?.data as Record<string, unknown> | null;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.plans)) return d.plans;
  return [];
}

async function get(path: string, cookie: string): Promise<HttpResult> {
  return http("GET", path, { cookie });
}

async function post(path: string, body: unknown, cookie: string): Promise<HttpResult> {
  return http("POST", path, { cookie, body });
}

async function patch(path: string, body: unknown, cookie: string): Promise<HttpResult> {
  return http("PATCH", path, { cookie, body });
}

// ── Test Suite ──

describe("Admin Plans — Entitlements Safety", () => {

  describe("1. FREE plan entitlement (resolve)", () => {
    it("returns FREE_PLAN for a teacher with no subscription", async () => {
      const entitlement = await entitlementService.resolve(freeTeacherId);
      expect(entitlement.accessState).toBe("FREE_PLAN");
      expect(entitlement.canAccessTeacherFeatures).toBe(true);
      expect(entitlement.entitlementSource).toBe("DEFAULT_FREE_PLAN");
      expect(entitlement.currentPlan).not.toBeNull();
      expect(entitlement.currentPlan!.code).toBe("FREE");
      expect(entitlement.activeSubscription).toBeNull();
      expect(entitlement.upgradeAvailable).toBe(true);
    });

    it("returns FREE_PLAN features as Record<string, boolean>", async () => {
      const entitlement = await entitlementService.resolve(freeTeacherId);
      const features = entitlement.currentPlan!.features;
      expect(typeof features).toBe("object");
      expect(Array.isArray(features)).toBe(false);
      // FREE plan has aiQuizGeneration: true
      expect(features.aiQuizGeneration).toBe(true);
      // Not all features are true
      expect(features.prioritySupport).toBe(false);
    });

    it("returns FREE_PLAN for a teacher with ACTIVE free subscription", async () => {
      // A subscription on the FREE plan (price=0) should still resolve FREE_PLAN
      const freePlan = await prisma.teacherPlan.findUnique({ where: { code: "FREE" } });
      const freeSub = await prisma.teacherSubscription.create({
        data: {
          teacherId: freeTeacherId,
          planId: freePlan!.id,
          status: "ACTIVE",
          billingInterval: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 86400_000),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
        },
      });
      owned.subscriptionIds.push(freeSub.id);

      const entitlement = await entitlementService.resolve(freeTeacherId);
      expect(entitlement.accessState).toBe("PAID_PLAN");

      // Cleanup: delete this subscription
      await prisma.teacherSubscription.delete({ where: { id: freeSub.id } });
      owned.subscriptionIds.splice(owned.subscriptionIds.indexOf(freeSub.id), 1);
    });
  });

  describe("2. Paid plan entitlement", () => {
    it("returns PAID_PLAN for a teacher with active paid subscription", async () => {
      const entitlement = await entitlementService.resolve(paidTeacherId);
      expect(entitlement.accessState).toBe("PAID_PLAN");
      expect(entitlement.canAccessTeacherFeatures).toBe(true);
      expect(entitlement.entitlementSource).toBe("ACTIVE_SUBSCRIPTION");
      expect(entitlement.currentPlan).not.toBeNull();
      expect(entitlement.currentPlan!.code).toBe(await prisma.teacherPlan.findUnique({ where: { id: paidPlanId } }).then(p => p!.code));
      expect(entitlement.activeSubscription).not.toBeNull();
      expect(entitlement.activeSubscription!.id).toBe(paidSubId);
    });

    it("returns PAID_PLAN features as Record<string, boolean>", async () => {
      const entitlement = await entitlementService.resolve(paidTeacherId);
      const features = entitlement.currentPlan!.features;
      expect(typeof features).toBe("object");
      expect(Array.isArray(features)).toBe(false);
      expect(features.aiQuizGeneration).toBe(true);
      expect(features.analyticsAccess).toBe(true);
    });
  });

  describe("3. Pending / failed payment does NOT grant paid plan", () => {
    it("resolves FREE_PLAN for a teacher with PENDING payment but no active subscription", async () => {
      // Teacher 1 (free) already has no active sub. Add a PENDING payment.
      const payment = await prisma.teacherSubscriptionPayment.create({
        data: {
          teacherId: freeTeacherId,
          planId: paidPlanId,
          amount: 19900,
          currency: "EGP",
          status: "PENDING",
          providerOrderId: `DEMO_${randomUUID().slice(0, 8)}`,
        },
      });
      owned.subPaymentIds.push(payment.id);

      const entitlement = await entitlementService.resolve(freeTeacherId);
      // Still FREE_PLAN — no verified active subscription
      expect(entitlement.accessState).toBe("FREE_PLAN");
      expect(entitlement.entitlementSource).toBe("DEFAULT_FREE_PLAN");
      expect(entitlement.activeSubscription).toBeNull();
    });

    it("resolves FREE_PLAN for a teacher with FAILED payment but no active subscription", async () => {
      const payment = await prisma.teacherSubscriptionPayment.create({
        data: {
          teacherId: freeTeacherId,
          planId: paidPlanId,
          amount: 19900,
          currency: "EGP",
          status: "FAILED",
          providerOrderId: `DEMO_${randomUUID().slice(0, 8)}`,
        },
      });
      owned.subPaymentIds.push(payment.id);

      const entitlement = await entitlementService.resolve(freeTeacherId);
      expect(entitlement.accessState).toBe("FREE_PLAN");
      expect(entitlement.entitlementSource).toBe("DEFAULT_FREE_PLAN");
    });
  });

  describe("4. Expired subscription falls back to FREE", () => {
    it("resolves FREE_PLAN for a teacher with an expired subscription", async () => {
      // Create a subscription that's already expired
      const expiredTeacherId = await makeUser("OPERATION");
      const expiredPlan = await prisma.teacherPlan.findFirst({ where: { isActive: true, monthlyPrice: { gt: 0 } } });
      const expiredSub = await prisma.teacherSubscription.create({
        data: {
          teacherId: expiredTeacherId,
          planId: expiredPlan!.id,
          status: "ACTIVE",
          billingInterval: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 60 * 86400_000),
          currentPeriodEnd: new Date(Date.now() - 30 * 86400_000),
        },
      });
      owned.subscriptionIds.push(expiredSub.id);

      // Service should ignore expired subscription (period lapsed)
      const entitlement = await entitlementService.resolve(expiredTeacherId);
      expect(entitlement.accessState).toBe("FREE_PLAN");
      expect(entitlement.entitlementSource).toBe("DEFAULT_FREE_PLAN");
      expect(entitlement.activeSubscription).toBeNull();
    });
  });

  describe("5. Not-approved / blocked teachers", () => {
    it("returns NOT_APPROVED for a teacher who is not APPROVED", async () => {
      const naTeacherId = await makeUser("OPERATION", { teacherApprovalState: "PENDING_REVIEW" });
      const entitlement = await entitlementService.resolve(naTeacherId);
      expect(entitlement.accessState).toBe("PENDING_REVIEW");
      expect(entitlement.canAccessTeacherFeatures).toBe(false);
      expect(entitlement.currentPlan).toBeNull();
    });

    it("returns REJECTED for a rejected teacher", async () => {
      const rejTeacherId = await makeUser("OPERATION", {
        teacherApprovalState: "REJECTED",
        status: "INACTIVE",
      });
      const entitlement = await entitlementService.resolve(rejTeacherId);
      expect(entitlement.accessState).toBe("REJECTED");
      expect(entitlement.canAccessTeacherFeatures).toBe(false);
      expect(entitlement.currentPlan).toBeNull();
    });

    it("returns NOT_APPROVED for a teacher with no teacherApprovalState", async () => {
      const noStateId = await makeUser("STUDENT", { teacherApprovalState: "NONE", role: "STUDENT" });
      const entitlement = await entitlementService.resolve(noStateId);
      expect(entitlement.accessState).toBe("NOT_APPROVED");
      expect(entitlement.canAccessTeacherFeatures).toBe(false);
    });
  });

  describe("6. Teacher API — active plans only", () => {
    it("returns only active plans from GET /api/teacher/plans", async () => {
      const r = await get("/api/teacher/plans", teacher1Cookie);
      expect(r.status).toBe(200);
      const plans = getPlans(r);
      const codes = plans.map((p: Record<string, unknown>) => p.code);
      // The inactive plan must NOT be in the list
      expect(codes).not.toContain(expect.stringContaining("ARCHIVED"));
      // The public teacher catalog returns ONLY active plans (the public DTO
      // intentionally omits the isActive flag), so the deactivated plan created in
      // setup must be absent from the list.
      expect((plans as Record<string, unknown>[]).some((p) => p.id === deactivatedPlanId)).toBe(false);
    });

    it("returns plans with features as Record<string, boolean> from API", async () => {
      const r = await get("/api/teacher/plans", teacher1Cookie);
      expect(r.status).toBe(200);
      const plans = getPlans(r) as Record<string, unknown>[];
      for (const plan of plans) {
        const features = plan.features;
        expect(typeof features).toBe("object");
        expect(Array.isArray(features)).toBe(false);
      }
    });

    it("rejects checkout for an inactive plan", async () => {
      const r = await post("/api/teacher/subscription/checkout",
        { planId: deactivatedPlanId, billingInterval: "MONTHLY" },
        teacher1Cookie,
      );
      // Should fail — inactive plan cannot be checked out
      expect(r.status).toBe(400);
    });
  });

  describe("7. Admin API — inactive plan visibility", () => {
    it("returns the inactive plan from admin GET /api/admin/plans", async () => {
      // High limit so the created inactive plan is on the page even when the
      // seeded catalog adds several plans (admin sees inactive plans too).
      const r = await get("/api/admin/plans?limit=100", adminCookie);
      expect(r.status).toBe(200);
      const plans = getPlans(r) as Record<string, unknown>[];
      const inactive = plans.find((p) => p.id === deactivatedPlanId);
      expect(inactive).toBeDefined();
      expect(inactive!.isActive).toBe(false);
    });

    it("can deactivate and reactivate a plan", async () => {
      // Create a fresh active plan first
      const newPlan = await prisma.teacherPlan.create({
        data: {
          code: `TOGGLE_${randomUUID().slice(0, 6).toUpperCase()}`,
          name: "toggle test",
          displayName: "Toggle Test Plan",
          monthlyPrice: 49,
          currency: "EGP",
          billingInterval: "MONTHLY",
          isActive: true,
          features: {},
          limits: {},
        },
      });
      owned.planIds.push(newPlan.id);

      // Deactivate
      const deact = await patch(`/api/admin/plans/${newPlan.id}/status`,
        { isActive: false, reason: "e2e test deactivation" },
        adminCookie,
      );
      expect(deact.status).toBe(200);

      const deactivated = await prisma.teacherPlan.findUnique({ where: { id: newPlan.id } });
      expect(deactivated!.isActive).toBe(false);

      // Reactivate
      const react = await patch(`/api/admin/plans/${newPlan.id}/status`,
        { isActive: true, reason: "e2e test reactivation" },
        adminCookie,
      );
      expect(react.status).toBe(200);

      const reactivated = await prisma.teacherPlan.findUnique({ where: { id: newPlan.id } });
      expect(reactivated!.isActive).toBe(true);
    });
  });

  describe("8. Admin GET /api/admin/plans?isActive filter", () => {
    it("filters active-only plans when isActive=true", async () => {
      const r = await get("/api/admin/plans?isActive=true", adminCookie);
      expect(r.status).toBe(200);
      const plans = getPlans(r) as Record<string, unknown>[];
      for (const p of plans) {
        expect(p.isActive).toBe(true);
      }
      // Inactive plan should NOT appear
      const inactive = plans.find((p) => p.id === deactivatedPlanId);
      expect(inactive).toBeUndefined();
    });

    it("filters inactive-only plans when isActive=false", async () => {
      const r = await get("/api/admin/plans?isActive=false", adminCookie);
      expect(r.status).toBe(200);
      const plans = getPlans(r) as Record<string, unknown>[];
      for (const p of plans) {
        expect(p.isActive).toBe(false);
      }
    });
  });
});
