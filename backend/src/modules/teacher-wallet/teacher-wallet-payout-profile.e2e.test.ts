/**
 * Teacher wallet + payout-profile E2E contract tests (real HTTP, real DB).
 *
 * Covers: GET /api/teacher/wallet, GET /api/teacher/payout-profile,
 * PATCH /api/teacher/payout-profile.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

const PW = "TeacherWallet@2026";
const P = "e2e-twallet";

const EMAILS = {
  teacherA: `${P}-teacher-a@e2e.test`, // earnings + full withdrawal mix
  teacherB: `${P}-teacher-b@e2e.test`, // zero earnings, payout-profile edits
  student: `${P}-student@e2e.test`,
} as const;

const IDS = {
  stage: `${P}-stage`,
  chapter: `${P}-chapter`,
  plan: `${P}-plan`,
};

let server: Server;
let base: string;
let teacherAId = "";
let teacherBId = "";

interface HttpResult {
  status: number;
  json: {
    success?: boolean;
    message?: string;
    code?: string;
    data?: Record<string, unknown>;
  } | null;
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
  const r = await http("POST", "/api/v1/auth/login", {
    body: { email, password: PW },
  });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

let mobileSeq = 6_000_000;
function mobile(): string {
  mobileSeq += 1;
  return `0109${String(mobileSeq).slice(-7)}`;
}

async function upsertTeacher(email: string): Promise<string> {
  const pwHash = await bcrypt.hash(PW, 12);
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: `E2E Teacher — ${email}`,
      mobile: mobile(),
      password: pwHash,
      role: "OPERATION",
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
    },
    update: { status: "ACTIVE", teacherApprovalState: "APPROVED", password: pwHash },
  });
  await prisma.teacherProfile.upsert({
    where: { userId: u.id },
    create: { userId: u.id },
    update: {
      instaPayHandle: null,
      vodafoneCashNumber: null,
      payoutMethodUpdatedAt: null,
    },
  });
  return u.id;
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  teacherAId = await upsertTeacher(EMAILS.teacherA);
  teacherBId = await upsertTeacher(EMAILS.teacherB);

  await prisma.stage.upsert({
    where: { id: IDS.stage },
    create: { id: IDS.stage, name: "E2E Wallet Stage", sortOrder: 9500, teacherId: teacherAId },
    update: { teacherId: teacherAId, deletedAt: null },
  });
  await prisma.chapter.upsert({
    where: { id: IDS.chapter },
    create: { id: IDS.chapter, name: "E2E Wallet Chapter", sortOrder: 1, stageId: IDS.stage, price: 100 },
    update: { deletedAt: null, stageId: IDS.stage, price: 100 },
  });

  const pwHash = await bcrypt.hash(PW, 12);
  const student = await prisma.user.upsert({
    where: { email: EMAILS.student },
    create: {
      email: EMAILS.student,
      fullName: "E2E Wallet Student",
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    create: { userId: student.id, stageId: IDS.stage },
    update: { stageId: IDS.stage },
  });

  // Clean any prior run's mutable rows for a deterministic re-run.
  await prisma.paymentTransaction.deleteMany({ where: { chapterId: IDS.chapter } });
  await prisma.teacherWithdrawalRequest.deleteMany({
    where: { teacherId: { in: [teacherAId, teacherBId] } },
  });
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { teacherId: teacherAId } });
  await prisma.teacherPlan.deleteMany({ where: { id: IDS.plan } });

  // ── Student payments on teacherA's chapter ──
  // Only the SUCCESS row (1000) must count as teacherA's earnings.
  await prisma.paymentTransaction.createMany({
    data: [
      {
        id: `${P}-pt-success`,
        studentId: student.id,
        chapterId: IDS.chapter,
        paymobOrderId: `${P.toUpperCase()}_ORD_SUCCESS`,
        paymobTransactionId: `${P.toUpperCase()}_TXN_SUCCESS`,
        amount: 1000,
        currency: "EGP",
        status: "SUCCESS",
      },
      {
        id: `${P}-pt-pending`,
        studentId: student.id,
        chapterId: IDS.chapter,
        paymobOrderId: `${P.toUpperCase()}_ORD_PENDING`,
        amount: 500,
        currency: "EGP",
        status: "PENDING",
      },
      {
        id: `${P}-pt-failed`,
        studentId: student.id,
        chapterId: IDS.chapter,
        paymobOrderId: `${P.toUpperCase()}_ORD_FAILED`,
        amount: 300,
        currency: "EGP",
        status: "FAILED",
        errorMessage: "declined",
      },
    ],
  });

  // ── teacherA's OWN plan-subscription payment — must NEVER count as earnings ──
  await prisma.teacherPlan.create({
    data: {
      id: IDS.plan,
      code: `${P}-plan-code`,
      name: "E2E Wallet Plan",
      displayName: "E2E Wallet Plan",
      monthlyPrice: 200,
    },
  });
  await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId: teacherAId,
      planId: IDS.plan,
      providerOrderId: `${P.toUpperCase()}_SUB_ORD`,
      providerTransactionId: `${P.toUpperCase()}_SUB_TXN`,
      amount: 200,
      currency: "EGP",
      status: "SUCCESS",
    },
  });

  // ── teacherA's withdrawal mix: TRANSFERRED=200, PENDING=100, PROCESSING=50,
  //    REJECTED=80, CANCELLED=70 (the last two must be fully excluded). ──
  await prisma.teacherWithdrawalRequest.createMany({
    data: [
      { teacherId: teacherAId, amount: 200, status: "TRANSFERRED", transferredAt: new Date() },
      { teacherId: teacherAId, amount: 100, status: "PENDING" },
      { teacherId: teacherAId, amount: 50, status: "PROCESSING", processedAt: new Date() },
      { teacherId: teacherAId, amount: 80, status: "REJECTED", cancelledAt: new Date() },
      { teacherId: teacherAId, amount: 70, status: "CANCELLED", cancelledAt: new Date() },
    ],
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("Teacher wallet + payout profile", () => {
  it("1. teacher can get their wallet", async () => {
    const cookie = await login(EMAILS.teacherA);
    const r = await http("GET", "/api/teacher/wallet", { cookie });
    expect(r.status).toBe(200);
    expect(r.json?.data).toBeTruthy();
  });

  it("2 & 3. wallet counts only SUCCESS student payments, excludes teacher-plan payments", async () => {
    const cookie = await login(EMAILS.teacherA);
    const r = await http("GET", "/api/teacher/wallet", { cookie });
    // 1000 SUCCESS only — NOT +500 (pending), NOT +300 (failed), NOT +200 (own plan payment).
    expect(r.json?.data?.totalConfirmedEarnings).toBe(1000);
  });

  it("4-8. availableBalance = earnings - transferred - held; rejected/cancelled excluded", async () => {
    const cookie = await login(EMAILS.teacherA);
    const r = await http("GET", "/api/teacher/wallet", { cookie });
    const data = r.json!.data!;
    expect(data.totalConfirmedEarnings).toBe(1000);
    expect(data.completedWithdrawals).toBe(200); // TRANSFERRED only
    expect(data.heldWithdrawals).toBe(150); // PENDING(100) + PROCESSING(50)
    // If REJECTED/CANCELLED were wrongly held/transferred this would be 420, not 650.
    expect(data.availableBalance).toBe(650);
    expect(data.currency).toBe("EGP");
  });

  it("wallet lists latestWithdrawals and never goes negative", async () => {
    const cookie = await login(EMAILS.teacherA);
    const r = await http("GET", "/api/teacher/wallet", { cookie });
    const data = r.json!.data!;
    expect(Array.isArray(data.latestWithdrawals)).toBe(true);
    expect((data.latestWithdrawals as unknown[]).length).toBeGreaterThanOrEqual(5);
    expect((data.availableBalance as number) >= 0).toBe(true);
  });

  it("teacher with no earnings sees zeroed wallet (isolated from teacherA)", async () => {
    const cookie = await login(EMAILS.teacherB);
    const r = await http("GET", "/api/teacher/wallet", { cookie });
    const data = r.json!.data!;
    expect(data.totalConfirmedEarnings).toBe(0);
    expect(data.availableBalance).toBe(0);
    expect(data.heldWithdrawals).toBe(0);
    expect(data.completedWithdrawals).toBe(0);
  });

  it("9. teacher can update InstaPay/Vodafone Cash", async () => {
    const cookie = await login(EMAILS.teacherB);
    const patch = await http("PATCH", "/api/teacher/payout-profile", {
      cookie,
      body: { instaPayHandle: "teacher.b@instapay", vodafoneCashNumber: "01012345678" },
    });
    expect(patch.status).toBe(200);
    expect(patch.json?.data?.instaPayHandle).toBe("teacher.b@instapay");
    expect(patch.json?.data?.vodafoneCashNumber).toBe("01012345678");
    expect(patch.json?.data?.payoutMethodUpdatedAt).toBeTruthy();

    const get = await http("GET", "/api/teacher/payout-profile", { cookie });
    expect(get.json?.data?.instaPayHandle).toBe("teacher.b@instapay");

    const wallet = await http("GET", "/api/teacher/wallet", { cookie });
    expect(wallet.json?.data?.payoutProfile).toMatchObject({
      instaPayHandle: "teacher.b@instapay",
      vodafoneCashNumber: "01012345678",
    });
  });

  it("10. whitespace-only payout fields are rejected", async () => {
    const cookie = await login(EMAILS.teacherB);
    const r = await http("PATCH", "/api/teacher/payout-profile", {
      cookie,
      body: { instaPayHandle: "   " },
    });
    expect(r.status).toBe(400);
  });

  it("10b. invalid Vodafone Cash number format is rejected", async () => {
    const cookie = await login(EMAILS.teacherB);
    const r = await http("PATCH", "/api/teacher/payout-profile", {
      cookie,
      body: { vodafoneCashNumber: "not-a-number" },
    });
    expect(r.status).toBe(400);
  });

  it("10c. empty PATCH body is rejected (at least one field required)", async () => {
    const cookie = await login(EMAILS.teacherB);
    const r = await http("PATCH", "/api/teacher/payout-profile", { cookie, body: {} });
    expect(r.status).toBe(400);
  });

  it("11. teacher A and teacher B never see each other's wallet/payout data", async () => {
    const cookieA = await login(EMAILS.teacherA);
    const walletA = await http("GET", "/api/teacher/wallet", { cookie: cookieA });
    // teacherA's own numbers are unaffected by teacherB's payout-profile edit.
    expect(walletA.json?.data?.totalConfirmedEarnings).toBe(1000);
    expect(walletA.json?.data?.payoutProfile).toMatchObject({
      instaPayHandle: null,
      vodafoneCashNumber: null,
    });
  });

  it("12. student is denied access to the teacher wallet endpoints", async () => {
    const cookie = await login(EMAILS.student);
    const wallet = await http("GET", "/api/teacher/wallet", { cookie });
    expect(wallet.status).toBe(403);
    const profile = await http("GET", "/api/teacher/payout-profile", { cookie });
    expect(profile.status).toBe(403);
  });

  it("13. unauthenticated requests are denied", async () => {
    const wallet = await http("GET", "/api/teacher/wallet");
    expect(wallet.status).toBe(401);
    const profile = await http("GET", "/api/teacher/payout-profile");
    expect(profile.status).toBe(401);
    const patch = await http("PATCH", "/api/teacher/payout-profile", {
      body: { instaPayHandle: "x@y" },
    });
    expect(patch.status).toBe(401);
  });
});
