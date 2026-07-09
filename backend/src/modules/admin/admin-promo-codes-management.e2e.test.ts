import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

// Mock Paymob so teacher checkout never touches the network.
vi.mock("../payment/paymob.service.js", () => ({
  PaymobService: class {
    async getValidToken() { return "e2e-token"; }
    async createOrder() { return `e2e-order-${randomUUID()}`; }
    async getPaymentKey() { return "e2e-payment-key"; }
    buildIframeUrl(key: string) { return `https://pay.test/iframe/${key}`; }
  },
}));

const { createApp } = await import("../../app.js");
const { prisma } = await import("../../config/database.js");

let server: Server;
let base: string;
const PW = "AdminPromo@123";
const RUN = randomUUID().slice(0, 8);
let pwHash: string;

const owned = {
  userIds: [] as string[], planIds: [] as string[], stageIds: [] as string[],
  chapterIds: [] as string[], promoIds: [] as string[],
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
  const c = r.setCookie.map((x) => x.split(";")[0]!).find((x) => x.startsWith("access_token="));
  if (!c) throw new Error(`login failed ${email}`);
  return c;
}
const dataOf = (r: Res) => (r.json?.data ?? {}) as Record<string, any>;
const codeOf = (r: Res) => (r.json as { code?: string })?.code;
let mob = 300000000;
const nextMobile = () => `019${(mob++).toString().padStart(8, "0")}`;

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", label: string) {
  const id = randomUUID();
  const email = `apc-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id, email, fullName: `APC ${label} ${RUN}`, mobile: nextMobile(), password: pwHash, role,
      status: "ACTIVE", ...(role === "OPERATION" ? { teacherApprovalState: "APPROVED" as const } : {}),
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let adminCookie: string, studentCookie: string, teacherCookie: string;
let teacherId: string;
let planMainId: string, planOtherId: string, chapterId: string;

// Create a promo through the admin API and track it for cleanup.
async function adminCreate(body: Record<string, unknown>): Promise<Res> {
  const r = await http("POST", "/api/admin/promo-codes", { cookie: adminCookie, body });
  if (r.status === 201) owned.promoIds.push(dataOf(r).id as string);
  return r;
}
async function clearTeacherPayments() {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId } });
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN", "Admin");
  const student = await makeUser("STUDENT", "Student");
  const teacher = await makeUser("OPERATION", "Teacher");
  teacherId = teacher.id;
  adminCookie = await login(admin.email);
  studentCookie = await login(student.email);
  teacherCookie = await login(teacher.email);

  const pm = await prisma.teacherPlan.create({ data: { code: `APC-M-${RUN}`, name: "m", displayName: "APC Main", monthlyPrice: 200 }, select: { id: true } });
  planMainId = pm.id; owned.planIds.push(pm.id);
  const po = await prisma.teacherPlan.create({ data: { code: `APC-O-${RUN}`, name: "o", displayName: "APC Other", monthlyPrice: 100 }, select: { id: true } });
  planOtherId = po.id; owned.planIds.push(po.id);

  const stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `apc-stage-${RUN}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(stageId);
  chapterId = randomUUID();
  await prisma.chapter.create({ data: { id: chapterId, name: `apc-chapter-${RUN}`, sortOrder: 1, stageId, price: 300 } });
  owned.chapterIds.push(chapterId);
});

afterAll(async () => {
  await prisma.platformPromoRedemption.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.platformPromoCode.deleteMany({ where: { createdById: { in: owned.userIds } } });
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("Admin Promo Codes — CRUD + scope", () => {
  it("1. admin creates a COURSE_PURCHASE promo", async () => {
    const r = await adminCreate({ code: `CRS-${RUN}`, scope: "COURSE_PURCHASE", discountType: "PERCENTAGE", discountValue: 15 });
    expect(r.status).toBe(201);
    expect(dataOf(r).scope).toBe("COURSE_PURCHASE");
  });

  it("2. admin creates a TEACHER_PLAN promo (plan + interval restricted)", async () => {
    const r = await adminCreate({
      code: `PLAN-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10,
      applicablePlanIds: [planMainId], billingInterval: "MONTHLY",
    });
    expect(r.status).toBe(201);
    expect(dataOf(r).scope).toBe("TEACHER_PLAN");
    expect(dataOf(r).applicablePlanIds).toEqual([planMainId]);
  });

  it("3. admin lists + filters by scope", async () => {
    const rc = await http("GET", "/api/admin/promo-codes?scope=COURSE_PURCHASE&limit=100", { cookie: adminCookie });
    expect(rc.status).toBe(200);
    expect((dataOf(rc).data as any[]).every((p) => p.scope === "COURSE_PURCHASE")).toBe(true);
    const rp = await http("GET", "/api/admin/promo-codes?scope=TEACHER_PLAN&limit=100", { cookie: adminCookie });
    expect((dataOf(rp).data as any[]).every((p) => p.scope === "TEACHER_PLAN")).toBe(true);
  });
});

describe("Admin Promo Codes — teacher checkout validation", () => {
  it("4. inactive promo rejected", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `INACT-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10, isActive: false });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `INACT-${RUN}` } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_INACTIVE");
  });

  it("5. expired promo rejected", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `EXP-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10, expiresAt: "2020-01-01T00:00:00.000Z" });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `EXP-${RUN}` } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_EXPIRED");
  });

  it("6. over-limit promo rejected", async () => {
    await clearTeacherPayments();
    const c = await adminCreate({ code: `LIM-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10, maxUses: 1 });
    await prisma.platformPromoCode.update({ where: { id: dataOf(c).id as string }, data: { usedCount: 1 } });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `LIM-${RUN}` } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_LIMIT_REACHED");
  });

  it("7. COURSE_PURCHASE code rejected on teacher checkout (scope separation)", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `CRSX-${RUN}`, scope: "COURSE_PURCHASE", discountType: "PERCENTAGE", discountValue: 10 });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `CRSX-${RUN}` } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_SCOPE_MISMATCH");
  });

  it("8. TEACHER_PLAN code rejected on course checkout (scope separation)", async () => {
    await adminCreate({ code: `PLANX-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10 });
    const r = await http("POST", "/api/promo-codes/course/discount", { cookie: studentCookie, body: { code: `PLANX-${RUN}`, chapterId } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_SCOPE_MISMATCH");
  });

  it("9. TEACHER_PLAN applies to allowed plan", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `OK-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10, applicablePlanIds: [planMainId], billingInterval: "MONTHLY" });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `OK-${RUN}` } });
    expect(r.status).toBe(201);
    const b = r.json as any; // checkout response is flat (not under .data)
    expect(b.discount).toBe(20);
    expect(b.amount).toBe(180);
  });

  it("10. TEACHER_PLAN rejected for a non-applicable plan", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `WRONGPLAN-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10, applicablePlanIds: [planOtherId] });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `WRONGPLAN-${RUN}` } });
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("PROMO_PLAN_NOT_ALLOWED");
  });

  it("11 & 13. discount computed server-side; Paymob/stored amount = final", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `PCT20-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 20 });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `PCT20-${RUN}` } });
    expect(r.status).toBe(201);
    const b = r.json as any;
    expect(b.originalAmount).toBe(200);
    expect(b.discount).toBe(40);
    expect(b.amount).toBe(160);
    const stored = await prisma.teacherSubscriptionPayment.findUnique({ where: { id: b.paymentId as string }, select: { amount: true } });
    expect(stored?.amount).toBe(160); // Paymob amount = final
  });

  it("12. fixed discount cannot make final amount negative (clamped to 0)", async () => {
    await clearTeacherPayments();
    await adminCreate({ code: `FIXBIG-${RUN}`, scope: "TEACHER_PLAN", discountType: "FIXED_AMOUNT", discountValue: 10000 });
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `FIXBIG-${RUN}` } });
    expect(r.status).toBe(201);
    const b = r.json as any;
    expect(b.discount).toBe(200);
    expect(b.amount).toBe(0);
  });

  it("14. usedCount increments only after a valid checkout use", async () => {
    await clearTeacherPayments();
    const c = await adminCreate({ code: `USE-${RUN}`, scope: "TEACHER_PLAN", discountType: "PERCENTAGE", discountValue: 10 });
    const promoId = dataOf(c).id as string;
    const before = await http("GET", `/api/admin/promo-codes/${promoId}`, { cookie: adminCookie });
    expect(dataOf(before).usedCount).toBe(0);
    const r = await http("POST", "/api/teacher/subscription/checkout", { cookie: teacherCookie, body: { planId: planMainId, billingInterval: "MONTHLY", promoCode: `USE-${RUN}` } });
    expect(r.status).toBe(201);
    const after = await http("GET", `/api/admin/promo-codes/${promoId}`, { cookie: adminCookie });
    expect(dataOf(after).usedCount).toBe(1);
    const redemptions = await prisma.platformPromoRedemption.count({ where: { promoCodeId: promoId } });
    expect(redemptions).toBe(1);
  });
});

describe("Admin Promo Codes — access control", () => {
  it("15. non-admin access denied", async () => {
    expect((await http("GET", "/api/admin/promo-codes", { cookie: teacherCookie })).status).toBe(403);
    expect((await http("GET", "/api/admin/promo-codes", { cookie: studentCookie })).status).toBe(403);
    expect((await http("GET", "/api/admin/promo-codes")).status).toBe(401);
  });
});
