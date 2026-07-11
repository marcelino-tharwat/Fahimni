/**
 * Teacher withdrawal request + admin review E2E contract tests (real HTTP,
 * real DB). Covers the teacher-facing wallet withdrawal flow and the admin
 * review/status-transition flow, including the strict forward-only status
 * state machine (no step-back, no reopening a final request).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

const PW = "TeacherWithdrawal@2026";
const P = "e2e-twithdrawal";

const EMAILS = {
  teacherA: `${P}-teacher-a@e2e.test`, // main sequential lifecycle narrative
  teacherB: `${P}-teacher-b@e2e.test`, // race/double-submit + cross-teacher isolation
  teacherC: `${P}-teacher-c@e2e.test`, // no payout method
  student: `${P}-student@e2e.test`,
  admin: `${P}-admin@e2e.test`,
} as const;

const IDS = {
  stageA: `${P}-stage-a`,
  chapterA: `${P}-chapter-a`,
  stageB: `${P}-stage-b`,
  chapterB: `${P}-chapter-b`,
  stageC: `${P}-stage-c`,
  chapterC: `${P}-chapter-c`,
};

let server: Server;
let base: string;
let teacherAId = "";
let teacherBId = "";
let teacherCId = "";

interface HttpResult {
  status: number;
  json: {
    success?: boolean;
    message?: string;
    code?: string;
    data?: Record<string, unknown> | Record<string, unknown>[];
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

let mobileSeq = 7_000_000;
function mobile(): string {
  mobileSeq += 1;
  return `0106${String(mobileSeq).slice(-7)}`;
}

async function seedTeacher(
  email: string,
  stageId: string,
  chapterId: string,
  earnings: number,
  payoutMethod: boolean,
): Promise<string> {
  const pwHash = await bcrypt.hash(PW, 12);
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: `E2E Withdrawal Teacher — ${email}`,
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
    create: {
      userId: u.id,
      instaPayHandle: payoutMethod ? `${email}@instapay` : null,
      vodafoneCashNumber: payoutMethod ? "01001112222" : null,
    },
    update: {
      instaPayHandle: payoutMethod ? `${email}@instapay` : null,
      vodafoneCashNumber: payoutMethod ? "01001112222" : null,
    },
  });

  await prisma.stage.upsert({
    where: { id: stageId },
    create: { id: stageId, name: `E2E WD Stage ${stageId}`, sortOrder: 9600, teacherId: u.id },
    update: { teacherId: u.id, deletedAt: null },
  });
  await prisma.chapter.upsert({
    where: { id: chapterId },
    create: {
      id: chapterId,
      name: `E2E WD Chapter ${chapterId}`,
      sortOrder: 1,
      stageId,
      price: 100,
      teacherId: u.id,
    },
    update: { deletedAt: null, stageId, price: 100, teacherId: u.id },
  });

  // Reset mutable state for a deterministic re-run.
  await prisma.paymentTransaction.deleteMany({ where: { chapterId } });
  await prisma.teacherWithdrawalRequest.deleteMany({ where: { teacherId: u.id } });

  if (earnings > 0) {
    const student = await prisma.user.upsert({
      where: { email: `${P}-payer-${chapterId}@e2e.test` },
      create: {
        email: `${P}-payer-${chapterId}@e2e.test`,
        fullName: "E2E WD Payer",
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
      update: { status: "ACTIVE" },
    });
    await prisma.paymentTransaction.create({
      data: {
        studentId: student.id,
        chapterId,
        paymobOrderId: `${P.toUpperCase()}_ORD_${chapterId}`,
        paymobTransactionId: `${P.toUpperCase()}_TXN_${chapterId}`,
        amount: earnings,
        currency: "EGP",
        status: "SUCCESS",
      },
    });
  }

  return u.id;
}

async function getWallet(cookie: string) {
  const r = await http("GET", "/api/teacher/wallet", { cookie });
  return r.json?.data as Record<string, unknown>;
}

async function createWithdrawal(
  cookie: string,
  amount: number,
  teacherNote?: string,
): Promise<HttpResult> {
  return http("POST", "/api/teacher/withdrawals", {
    cookie,
    body: { amount, ...(teacherNote ? { teacherNote } : {}) },
  });
}

async function adminPatchStatus(
  adminCookie: string,
  withdrawalId: string,
  status: string,
  adminNote?: string,
): Promise<HttpResult> {
  return http("PATCH", `/api/admin/teacher-withdrawals/${withdrawalId}/status`, {
    cookie: adminCookie,
    body: { status, ...(adminNote ? { adminNote } : {}) },
  });
}

async function countAuditLogs(resourceId: string): Promise<number> {
  return prisma.auditLog.count({
    where: { resourceId, resourceType: "TEACHER_WITHDRAWAL_REQUEST" },
  });
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  teacherAId = await seedTeacher(EMAILS.teacherA, IDS.stageA, IDS.chapterA, 1000, true);
  teacherBId = await seedTeacher(EMAILS.teacherB, IDS.stageB, IDS.chapterB, 500, true);
  teacherCId = await seedTeacher(EMAILS.teacherC, IDS.stageC, IDS.chapterC, 300, false);

  const pwHash = await bcrypt.hash(PW, 12);
  await prisma.user.upsert({
    where: { email: EMAILS.student },
    create: {
      email: EMAILS.student,
      fullName: "E2E WD Student",
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });
  await prisma.user.upsert({
    where: { email: EMAILS.admin },
    create: {
      email: EMAILS.admin,
      fullName: "E2E WD Admin",
      mobile: mobile(),
      password: pwHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("Teacher withdrawal requests + admin review", () => {
  let teacherACookie: string;
  let adminCookie: string;

  it("setup: teacher.A wallet starts at earnings=1000, available=1000", async () => {
    teacherACookie = await login(EMAILS.teacherA);
    adminCookie = await login(EMAILS.admin);
    const wallet = await getWallet(teacherACookie);
    expect(wallet.totalConfirmedEarnings).toBe(1000);
    expect(wallet.availableBalance).toBe(1000);
    expect(wallet.heldWithdrawals).toBe(0);
    expect(wallet.completedWithdrawals).toBe(0);
  });

  let w1Id = "";
  it("1. teacher creates a withdrawal within available balance", async () => {
    const r = await createWithdrawal(teacherACookie, 100, "سحب أول");
    expect(r.status).toBe(201);
    const data = r.json!.data as Record<string, unknown>;
    expect(data.status).toBe("PENDING");
    expect(data.amount).toBe(100);
    expect(data.payoutMethodSnapshot).toMatchObject({
      instaPayHandle: `${EMAILS.teacherA}@instapay`,
      vodafoneCashNumber: "01001112222",
    });
    w1Id = data.id as string;
  });

  it("2. withdrawal over available balance is rejected", async () => {
    const r = await createWithdrawal(teacherACookie, 999999);
    expect(r.status).toBe(400);
    expect(r.json?.code).toBe("WITHDRAWAL_EXCEEDS_AVAILABLE_BALANCE");
  });

  it("3. teacher without a payout method cannot request a withdrawal", async () => {
    const cookie = await login(EMAILS.teacherC);
    const r = await createWithdrawal(cookie, 10);
    expect(r.status).toBe(400);
    expect(r.json?.code).toBe("WITHDRAWAL_PAYOUT_METHOD_REQUIRED");
  });

  it("4. PENDING withdrawal holds the amount", async () => {
    const wallet = await getWallet(teacherACookie);
    expect(wallet.heldWithdrawals).toBe(100);
    expect(wallet.availableBalance).toBe(900);
  });

  it("5 & 6. teacher cancels PENDING withdrawal and the held amount is released", async () => {
    const r = await http("PATCH", `/api/teacher/withdrawals/${w1Id}/cancel`, {
      cookie: teacherACookie,
    });
    expect(r.status).toBe(200);
    expect((r.json!.data as Record<string, unknown>).status).toBe("CANCELLED");

    const wallet = await getWallet(teacherACookie);
    expect(wallet.heldWithdrawals).toBe(0);
    expect(wallet.availableBalance).toBe(1000);
  });

  let w2Id = "";
  it("creates withdrawal w2 for the PROCESSING/TRANSFERRED lifecycle", async () => {
    const r = await createWithdrawal(teacherACookie, 100);
    expect(r.status).toBe(201);
    w2Id = (r.json!.data as Record<string, unknown>).id as string;
  });

  it("10 & 11. admin moves PENDING to PROCESSING; amount remains held", async () => {
    const r = await adminPatchStatus(adminCookie, w2Id, "PROCESSING");
    expect(r.status).toBe(200);
    expect((r.json!.data as Record<string, unknown>).status).toBe("PROCESSING");

    const wallet = await getWallet(teacherACookie);
    expect(wallet.heldWithdrawals).toBe(100);
  });

  it("7 & 25. teacher cannot cancel a PROCESSING withdrawal", async () => {
    const r = await http("PATCH", `/api/teacher/withdrawals/${w2Id}/cancel`, {
      cookie: teacherACookie,
    });
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_CANNOT_BE_CANCELLED");
  });

  it("12 & 13. admin marks PROCESSING as TRANSFERRED; deducts from available, adds to completed", async () => {
    const r = await adminPatchStatus(adminCookie, w2Id, "TRANSFERRED");
    expect(r.status).toBe(200);
    const data = r.json!.data as Record<string, unknown>;
    expect(data.status).toBe("TRANSFERRED");
    expect(data.transferredAt).toBeTruthy();

    const wallet = await getWallet(teacherACookie);
    expect(wallet.heldWithdrawals).toBe(0);
    expect(wallet.completedWithdrawals).toBe(100);
    expect(wallet.availableBalance).toBe(900);
  });

  it("8. teacher cannot cancel a TRANSFERRED withdrawal", async () => {
    const r = await http("PATCH", `/api/teacher/withdrawals/${w2Id}/cancel`, {
      cookie: teacherACookie,
    });
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_CANNOT_BE_CANCELLED");
  });

  it("21 & 26. admin cannot move PROCESSING/TRANSFERRED back to PENDING (step-back)", async () => {
    const before = await countAuditLogs(w2Id);
    const r = await adminPatchStatus(adminCookie, w2Id, "PENDING");
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_STATUS_STEP_BACK_NOT_ALLOWED");

    // 28 & 29: failed transition must not modify the record or write an audit log.
    const row = await prisma.teacherWithdrawalRequest.findUniqueOrThrow({ where: { id: w2Id } });
    expect(row.status).toBe("TRANSFERRED");
    expect(await countAuditLogs(w2Id)).toBe(before);
  });

  it("22 & 27. admin cannot change a TRANSFERRED request to any other status", async () => {
    const before = await countAuditLogs(w2Id);
    const r = await adminPatchStatus(adminCookie, w2Id, "REJECTED");
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_INVALID_STATUS_TRANSITION");
    expect(await countAuditLogs(w2Id)).toBe(before);
  });

  it("30. repeated TRANSFERRED update does not double-deduct the balance", async () => {
    const r = await adminPatchStatus(adminCookie, w2Id, "TRANSFERRED");
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_INVALID_STATUS_TRANSITION");

    const wallet = await getWallet(teacherACookie);
    expect(wallet.completedWithdrawals).toBe(100); // unchanged, not 200
  });

  let w3Id = "";
  it("creates withdrawal w3 for the direct PENDING -> REJECTED flow", async () => {
    const r = await createWithdrawal(teacherACookie, 50);
    expect(r.status).toBe(201);
    w3Id = (r.json!.data as Record<string, unknown>).id as string;
  });

  it("14 & 15 & 16. admin rejects a PENDING withdrawal; held amount is released", async () => {
    const walletBefore = await getWallet(teacherACookie);
    expect(walletBefore.heldWithdrawals).toBe(50);

    const r = await adminPatchStatus(adminCookie, w3Id, "REJECTED", "بيانات غير صحيحة");
    expect(r.status).toBe(200);
    expect((r.json!.data as Record<string, unknown>).status).toBe("REJECTED");

    const walletAfter = await getWallet(teacherACookie);
    expect(walletAfter.heldWithdrawals).toBe(0);
    expect(walletAfter.availableBalance).toBe(900);
  });

  it("23. admin cannot change a REJECTED request to any other status", async () => {
    // Sibling-final-to-sibling-final (same rank) → generic invalid transition.
    const toTransferred = await adminPatchStatus(adminCookie, w3Id, "TRANSFERRED");
    expect(toTransferred.status).toBe(409);
    expect(toTransferred.json?.code).toBe("WITHDRAWAL_INVALID_STATUS_TRANSITION");

    // Reopening a final request into a non-final state is a step-back.
    const toProcessing = await adminPatchStatus(adminCookie, w3Id, "PROCESSING");
    expect(toProcessing.status).toBe(409);
    expect(toProcessing.json?.code).toBe("WITHDRAWAL_STATUS_STEP_BACK_NOT_ALLOWED");
  });

  it("31. repeated REJECTED update does not double-release the held amount", async () => {
    const r = await adminPatchStatus(adminCookie, w3Id, "REJECTED");
    expect(r.status).toBe(409);
    const wallet = await getWallet(teacherACookie);
    expect(wallet.availableBalance).toBe(900); // unchanged, not over-released
  });

  let w4Id = "";
  it("33. PROCESSING -> REJECTED releases held amount and becomes final", async () => {
    const create = await createWithdrawal(teacherACookie, 50);
    w4Id = (create.json!.data as Record<string, unknown>).id as string;

    const toProcessing = await adminPatchStatus(adminCookie, w4Id, "PROCESSING");
    expect(toProcessing.status).toBe(200);
    const walletHeld = await getWallet(teacherACookie);
    expect(walletHeld.heldWithdrawals).toBe(50);

    const toRejected = await adminPatchStatus(adminCookie, w4Id, "REJECTED");
    expect(toRejected.status).toBe(200);
    expect((toRejected.json!.data as Record<string, unknown>).status).toBe("REJECTED");

    const walletAfter = await getWallet(teacherACookie);
    expect(walletAfter.heldWithdrawals).toBe(0);
    expect(walletAfter.availableBalance).toBe(900);

    // Final — no further change allowed.
    const again = await adminPatchStatus(adminCookie, w4Id, "TRANSFERRED");
    expect(again.status).toBe(409);
  });

  let w5Id = "";
  it("32. PENDING -> TRANSFERRED direct transition is intentionally allowed", async () => {
    const create = await createWithdrawal(teacherACookie, 100);
    w5Id = (create.json!.data as Record<string, unknown>).id as string;

    const r = await adminPatchStatus(adminCookie, w5Id, "TRANSFERRED");
    expect(r.status).toBe(200);
    const data = r.json!.data as Record<string, unknown>;
    expect(data.status).toBe("TRANSFERRED");
    expect(data.transferredAt).toBeTruthy();

    const wallet = await getWallet(teacherACookie);
    // completed = w2(100) + w5(100) = 200; held=0; available = 1000-200 = 800.
    expect(wallet.completedWithdrawals).toBe(200);
    expect(wallet.availableBalance).toBe(800);
  });

  it("24. admin cannot change a CANCELLED request to any other status", async () => {
    const create = await createWithdrawal(teacherACookie, 20);
    const id = (create.json!.data as Record<string, unknown>).id as string;
    const cancel = await http("PATCH", `/api/teacher/withdrawals/${id}/cancel`, {
      cookie: teacherACookie,
    });
    expect(cancel.status).toBe(200);

    const before = await countAuditLogs(id);
    // Sibling-final-to-sibling-final (same rank) → generic invalid transition.
    const r = await adminPatchStatus(adminCookie, id, "TRANSFERRED");
    expect(r.status).toBe(409);
    expect(r.json?.code).toBe("WITHDRAWAL_INVALID_STATUS_TRANSITION");
    expect(await countAuditLogs(id)).toBe(before);

    const row = await prisma.teacherWithdrawalRequest.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("CANCELLED");
  });

  it("9. admin lists withdrawal requests (with filters)", async () => {
    const all = await http("GET", "/api/admin/teacher-withdrawals?limit=100", {
      cookie: adminCookie,
    });
    expect(all.status).toBe(200);
    const items = (all.json!.data as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(w2Id);
    expect(ids).toContain(w3Id);

    const byStatus = await http(
      "GET",
      "/api/admin/teacher-withdrawals?status=TRANSFERRED&limit=100",
      { cookie: adminCookie },
    );
    const byStatusItems = (byStatus.json!.data as Record<string, unknown>)
      .data as Array<Record<string, unknown>>;
    expect(byStatusItems.every((i) => i.status === "TRANSFERRED")).toBe(true);

    const byTeacher = await http(
      "GET",
      `/api/admin/teacher-withdrawals?teacherId=${teacherAId}&limit=100`,
      { cookie: adminCookie },
    );
    const byTeacherItems = (byTeacher.json!.data as Record<string, unknown>)
      .data as Array<Record<string, unknown>>;
    expect(
      byTeacherItems.every((i) => (i.teacher as Record<string, unknown>).id === teacherAId),
    ).toBe(true);

    const detail = await http("GET", `/api/admin/teacher-withdrawals/${w2Id}`, {
      cookie: adminCookie,
    });
    expect(detail.status).toBe(200);
    const detailData = detail.json!.data as Record<string, unknown>;
    expect(detailData.payoutMethodSnapshot).toBeTruthy();
    expect((detailData.teacher as Record<string, unknown>).id).toBe(teacherAId);
  });

  it("19. audit logs are written for teacher and admin withdrawal actions", async () => {
    const w2Logs = await prisma.auditLog.findMany({
      where: { resourceId: w2Id, resourceType: "TEACHER_WITHDRAWAL_REQUEST" },
      select: { action: true },
    });
    const actions = w2Logs.map((l) => l.action);
    expect(actions).toContain("TEACHER_WITHDRAWAL_REQUESTED");
    expect(actions).toContain("ADMIN_WITHDRAWAL_PROCESSING");
    expect(actions).toContain("ADMIN_WITHDRAWAL_TRANSFERRED");
  });

  it("17. teacher cannot access or cancel another teacher's withdrawal", async () => {
    const create = await createWithdrawal(teacherACookie, 15);
    const teacherAWithdrawalId = (create.json!.data as Record<string, unknown>).id as string;

    const teacherBCookie = await login(EMAILS.teacherB);
    const cancelAttempt = await http(
      "PATCH",
      `/api/teacher/withdrawals/${teacherAWithdrawalId}/cancel`,
      { cookie: teacherBCookie },
    );
    expect(cancelAttempt.status).toBe(404);

    const listB = await http("GET", "/api/teacher/withdrawals", { cookie: teacherBCookie });
    const idsB = (listB.json!.data as Array<Record<string, unknown>>).map((w) => w.id);
    expect(idsB).not.toContain(teacherAWithdrawalId);
  });

  it("18. student is denied access to teacher and admin withdrawal endpoints", async () => {
    const cookie = await login(EMAILS.student);
    const teacherList = await http("GET", "/api/teacher/withdrawals", { cookie });
    expect(teacherList.status).toBe(403);
    const teacherCreate = await createWithdrawal(cookie, 10);
    expect(teacherCreate.status).toBe(403);
    const adminList = await http("GET", "/api/admin/teacher-withdrawals", { cookie });
    expect(adminList.status).toBe(403);
  });

  it("unauthenticated requests are denied on both teacher and admin endpoints", async () => {
    expect((await http("GET", "/api/teacher/withdrawals")).status).toBe(401);
    expect((await http("POST", "/api/teacher/withdrawals", { body: { amount: 10 } })).status).toBe(
      401,
    );
    expect((await http("GET", "/api/admin/teacher-withdrawals")).status).toBe(401);
  });

  it("20. concurrent withdrawal requests cannot together exceed available balance", async () => {
    const cookie = await login(EMAILS.teacherB);
    const before = await getWallet(cookie);
    expect(before.availableBalance).toBe(500);

    const [a, b] = await Promise.all([
      createWithdrawal(cookie, 400),
      createWithdrawal(cookie, 400),
    ]);
    const statuses = [a.status, b.status].sort();
    // Exactly one succeeds (400 <= 500), the other must fail — 400+400=800 > 500.
    expect(statuses).toEqual([201, 400]);

    const after = await getWallet(cookie);
    expect(after.heldWithdrawals).toBe(400);
    expect(after.availableBalance).toBe(100);
  });
});
