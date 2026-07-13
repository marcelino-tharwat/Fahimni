import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "WdgtSum@123";
const RUN = randomUUID().slice(0, 8);
let pwHash: string;

const owned = {
  userIds: [] as string[],
  planIds: [] as string[],
  subscriptionIds: [] as string[],
  paymentIds: [] as string[],
  withdrawalIds: [] as string[],
  chapterIds: [] as string[],
  stageIds: [] as string[],
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
  const email = `wsum-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id, email, fullName: `WSUM ${label} ${RUN}`, mobile: nextMobile(), password: pwHash, role,
      status: "ACTIVE",
      ...(role === "OPERATION" ? { teacherApprovalState: "APPROVED" as const } : {}),
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let adminCookie: string, studentCookie: string, operationCookie: string;
let planId: string;
let teacherA: { id: string; email: string };
let teacherB: { id: string; email: string };

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN", "Admin");
  const student = await makeUser("STUDENT", "Student");
  teacherA = await makeUser("OPERATION", "TeacherA");
  teacherB = await makeUser("OPERATION", "TeacherB");
  adminCookie = await login(admin.email);
  studentCookie = await login(student.email);
  operationCookie = await login(teacherA.email);

  // Create a plan for subscription payments
  const plan = await prisma.teacherPlan.create({
    data: { code: `WSUM-${RUN}`, name: "wsum", displayName: "WSUM Plan", monthlyPrice: 250 },
    select: { id: true },
  });
  planId = plan.id;
  owned.planIds.push(planId);

  // Create teacher profiles with subjects
  await prisma.teacherProfile.createMany({
    data: [
      { userId: teacherA.id, subject: "الرياضيات", bio: "Math teacher" },
      { userId: teacherB.id, subject: "الفيزياء", bio: "Physics teacher" },
    ],
  });

  // Create a stage for chapters
  const stage = await prisma.stage.create({
    data: { id: randomUUID(), name: `WSUM Stage ${RUN}`, sortOrder: 9999, isActive: true, teacherId: teacherA.id },
    select: { id: true },
  });
  owned.stageIds.push(stage.id);

  // Create chapters owned by each teacher
  const chapterA = await prisma.chapter.create({
    data: {
      id: randomUUID(), name: `WSUM ChA ${RUN}`, teacherId: teacherA.id, stageId: stage.id,
      price: 100, isVisible: true, sortOrder: 1,
    },
    select: { id: true },
  });
  owned.chapterIds.push(chapterA.id);

  const chapterB = await prisma.chapter.create({
    data: {
      id: randomUUID(), name: `WSUM ChB ${RUN}`, teacherId: teacherB.id, stageId: stage.id,
      price: 200, isVisible: true, sortOrder: 2,
    },
    select: { id: true },
  });
  owned.chapterIds.push(chapterB.id);

  // Teacher A: 2 SUCCESS payments = 300 total earnings
  await prisma.paymentTransaction.createMany({
    data: [
      { studentId: student.id, chapterId: chapterA.id, amount: 100, status: "SUCCESS", currency: "EGP" },
      { studentId: student.id, chapterId: chapterA.id, amount: 200, status: "SUCCESS", currency: "EGP" },
    ],
  });

  // Teacher A: 1 TRANSFERRED withdrawal = 100, 1 PENDING = 50
  const w1 = await prisma.teacherWithdrawalRequest.create({
    data: { teacherId: teacherA.id, amount: 100, status: "TRANSFERRED", transferredAt: new Date(), currency: "EGP" },
    select: { id: true },
  });
  owned.withdrawalIds.push(w1.id);
  const w2 = await prisma.teacherWithdrawalRequest.create({
    data: { teacherId: teacherA.id, amount: 50, status: "PENDING", currency: "EGP" },
    select: { id: true },
  });
  owned.withdrawalIds.push(w2.id);
  // 1 REJECTED (should not count as pending or withdrawn)
  const w3 = await prisma.teacherWithdrawalRequest.create({
    data: { teacherId: teacherA.id, amount: 30, status: "REJECTED", cancelledAt: new Date(), currency: "EGP" },
    select: { id: true },
  });
  owned.withdrawalIds.push(w3.id);

  // Teacher B: 1 SUCCESS payment = 200, 1 PENDING payment
  await prisma.paymentTransaction.createMany({
    data: [
      { studentId: student.id, chapterId: chapterB.id, amount: 200, status: "SUCCESS", currency: "EGP" },
      { studentId: student.id, chapterId: chapterB.id, amount: 150, status: "PENDING", currency: "EGP" },
    ],
  });

  // Teacher A: 1 SUCCESS subscription payment = 250
  const sub = await prisma.teacherSubscription.create({
    data: {
      teacherId: teacherA.id, planId, status: "ACTIVE", billingInterval: "MONTHLY",
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    },
    select: { id: true },
  });
  owned.subscriptionIds.push(sub.id);

  await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: teacherA.id, planId, subscriptionId: sub.id, provider: "PAYMOB",
      providerOrderId: `WSUM-ORD-${RUN}-1`, amount: 250, currency: "EGP",
      billingInterval: "MONTHLY", status: "SUCCESS",
    },
  });
  // 1 PENDING subscription payment (should not count)
  await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: teacherA.id, planId, provider: "PAYMOB",
      providerOrderId: `WSUM-ORD-${RUN}-2`, amount: 250, currency: "EGP",
      billingInterval: "MONTHLY", status: "PENDING",
    },
  });
});

afterAll(async () => {
  await prisma.paymentTransaction.deleteMany({ where: { chapterId: { in: owned.chapterIds } } });
  await prisma.teacherWithdrawalRequest.deleteMany({ where: { id: { in: owned.withdrawalIds } } });
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subscriptionIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("Admin Teacher Financial Summary", () => {
  it("1. admin can fetch teacher summary", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const data = r.json?.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it("2. non-admin cannot access teacher summary", async () => {
    const r1 = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: studentCookie });
    expect(r1.status).toBe(403);
    const r2 = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: operationCookie });
    expect(r2.status).toBe(403);
  });

  it("3. totalEarnings calculated correctly per teacher", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    expect(a).toBeDefined();
    expect(a!.totalEarnings).toBe(300); // 100 + 200
  });

  it("4. totalWithdrawn sums TRANSFERRED only", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    expect(a!.totalWithdrawn).toBe(100); // only TRANSFERRED
  });

  it("5. pendingWithdrawalAmount sums PENDING + PROCESSING", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    expect(a!.pendingWithdrawalAmount).toBe(50); // only PENDING
  });

  it("6. remainingAvailableBalance calculated correctly", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    // 300 (earnings) - 100 (withdrawn) - 50 (pending) = 150
    expect(a!.remainingAvailableBalance).toBe(150);
  });

  it("7. teacherSubscriptionTotalPaid includes only SUCCESS teacher plan payments", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    expect(a!.teacherSubscriptionTotalPaid).toBe(250); // only SUCCESS
  });

  it("8. student payments are not counted as teacher subscription payments", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data.find((d) => d.teacherId === teacherA.id);
    // totalEarnings=300 (student payments) and subscriptionPaid=250 are separate
    expect(a!.totalEarnings).toBe(300);
    expect(a!.teacherSubscriptionTotalPaid).toBe(250);
    // They are not mixed
    expect(a!.totalEarnings).not.toBe(a!.teacherSubscriptionTotalPaid);
  });

  it("9. filter by teacherId returns only that teacher", async () => {
    const r = await http("GET", `/api/admin/teacher-withdrawals/teacher-summary?teacherId=${teacherB.id}`, { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    expect(data.length).toBe(1);
    expect(data[0].teacherId).toBe(teacherB.id);
  });

  it("10. decimal/currency values are returned safely", async () => {
    const r = await http("GET", "/api/admin/teacher-withdrawals/teacher-summary", { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    for (const row of data) {
      expect(typeof row.totalEarnings).toBe("number");
      expect(typeof row.totalWithdrawn).toBe("number");
      expect(typeof row.pendingWithdrawalAmount).toBe("number");
      expect(typeof row.remainingAvailableBalance).toBe("number");
      expect(typeof row.teacherSubscriptionTotalPaid).toBe("number");
      expect(row.currency).toBe("EGP");
    }
  });

  it("11. teacher B has correct earnings (no withdrawals)", async () => {
    const r = await http("GET", `/api/admin/teacher-withdrawals/teacher-summary?teacherId=${teacherB.id}`, { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const b = data[0];
    expect(b.totalEarnings).toBe(200); // only SUCCESS payment
    expect(b.totalWithdrawn).toBe(0);
    expect(b.pendingWithdrawalAmount).toBe(0);
    expect(b.remainingAvailableBalance).toBe(200);
    expect(b.teacherSubscriptionTotalPaid).toBe(0);
  });

  it("12. current plan shown for teacher with active subscription", async () => {
    const r = await http("GET", `/api/admin/teacher-withdrawals/teacher-summary?teacherId=${teacherA.id}`, { cookie: adminCookie });
    const data = r.json?.data as Array<Record<string, unknown>>;
    const a = data[0];
    expect(a.currentPlan).toBe("WSUM Plan");
    expect(a.planExpiresAt).toBeTruthy();
  });
});
