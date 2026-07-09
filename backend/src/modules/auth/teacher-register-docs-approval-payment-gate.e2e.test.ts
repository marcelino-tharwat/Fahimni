import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for teacher registration-with-docs + approval + payment gate. Isolated test
 * DB, self-owned fixtures (unique run token), torn down afterwards. In the test
 * environment proof-document storage upload is skipped (metadata still recorded),
 * so no external Supabase call is made.
 */

let server: Server;
let base: string;
const PW = "Teacher@1234";
const RUN = randomUUID().slice(0, 8);
const email = (label: string) => `trd-${label}-${RUN}@e2e.test`;
let pwHash: string;
const mobiles = new Set<string>();
function mob(): string {
  // Valid Egyptian prefix (010/011/012/015) so the register validator accepts it.
  let m: string;
  do { m = `010${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`; } while (mobiles.has(m));
  mobiles.add(m);
  return m;
}
const owned = { userIds: [] as string[], requestIds: [] as string[], planIds: [] as string[], subIds: [] as string[], subPayIds: [] as string[], stageIds: [] as string[] };

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
async function postForm(path: string, fields: Record<string, string>, file?: { name: string; type: string; bytes: Uint8Array }): Promise<Res> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("proofDocuments", new Blob([file.bytes], { type: file.type }), file.name);
  const res = await fetch(`${base}${path}`, { method: "POST", body: fd });
  let json: Res["json"] = null;
  try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function login(em: string): Promise<Res> {
  return http("POST", "/api/v1/auth/login", { body: { email: em, password: PW } });
}
function cookieOf(r: Res): string | undefined {
  return r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
}

async function makeUser(label: string, over: Record<string, unknown>): Promise<{ id: string; email: string }> {
  const u = await prisma.user.create({
    data: {
      id: randomUUID(), email: email(label), fullName: `TRD ${label}`, mobile: mob(),
      password: pwHash, role: "OPERATION", ...over,
    } as never,
    select: { id: true, email: true },
  });
  owned.userIds.push(u.id);
  return u;
}
async function linkedRequest(userId: string, status: "PENDING" | "APPROVED" | "REJECTED", em: string): Promise<string> {
  const r = await prisma.teacherRegistrationRequest.create({
    data: { publicReference: `TRD-${RUN}-${owned.requestIds.length + 1}`, fullName: "TRD", email: em, mobile: mob(), status, proofDocuments: [], userId },
    select: { id: true },
  });
  owned.requestIds.push(r.id);
  return r.id;
}

let adminCookie: string;
let pending: { id: string; email: string }, rejected: { id: string; email: string };
let approvedUnpaid: { id: string; email: string }, activePaid: { id: string; email: string };
let pendingReqId: string;

const GATED = "/api/dashboard/teacher/stats"; // OPERATION + payment gate
const UNGATED = "/api/teacher/subscription/me"; // plans/subscription — reachable pre-payment

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await prisma.user.create({
    data: { id: randomUUID(), email: email("admin"), fullName: "TRD Admin", mobile: mob(), password: pwHash, role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  owned.userIds.push(admin.id);
  adminCookie = cookieOf(await login(admin.email))!;

  pending = await makeUser("pending", { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
  pendingReqId = await linkedRequest(pending.id, "PENDING", pending.email);
  rejected = await makeUser("rejected", { status: "INACTIVE", teacherApprovalState: "REJECTED" });
  approvedUnpaid = await makeUser("approved-unpaid", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
  activePaid = await makeUser("active-paid", { status: "ACTIVE", teacherApprovalState: "APPROVED" });

  // Active-paid teacher gets an ACTIVE subscription (represents Paymob-verified activation).
  const plan = await prisma.teacherPlan.create({ data: { code: `TRD-${RUN}`, name: "trd", displayName: "TRD Plan", monthlyPrice: 199 }, select: { id: true } });
  owned.planIds.push(plan.id);
  const sub = await prisma.teacherSubscription.create({
    data: { teacherId: activePaid.id, planId: plan.id, status: "ACTIVE", billingInterval: "MONTHLY", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    select: { id: true },
  });
  owned.subIds.push(sub.id);
  // Approved-unpaid has only a PENDING payment (must NOT unlock).
  const pay = await prisma.teacherSubscriptionPayment.create({
    data: { teacherId: approvedUnpaid.id, planId: plan.id, amount: 199, status: "PENDING", provider: "PAYMOB", providerOrderId: `trd-pend-${RUN}` },
    select: { id: true },
  });
  owned.subPayIds.push(pay.id);
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPayIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subIds } } });
  await prisma.teacherRegistrationRequest.deleteMany({ where: { email: { contains: `-${RUN}@e2e.test` } } });
  await prisma.teacherRegistrationRequest.deleteMany({ where: { id: { in: owned.requestIds } } });
  const regUsers = await prisma.user.findMany({ where: { email: { contains: `-${RUN}@e2e.test` } }, select: { id: true } });
  const allUserIds = [...new Set([...owned.userIds, ...regUsers.map((u) => u.id)])];
  await prisma.studentProfile.deleteMany({ where: { userId: { in: allUserIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: allUserIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: allUserIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: allUserIds } } });
  // Stages must go before their owning users (RESTRICT FK).
  await prisma.stage.deleteMany({ where: { teacherId: { in: allUserIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

const dataOf = (r: Res) => r.json?.data as Record<string, unknown>;

describe("Teacher registration with proof documents", () => {
  it("1-5. registers with password + proof doc → pending, linked request with proofDocuments, no secrets", async () => {
    const em = email("reg-docs");
    const r = await postForm("/api/v1/auth/register", {
      fullName: "Docs Teacher", email: em, mobile: mob(), password: PW, confirmPassword: PW, role: "OPERATION", subject: "Physics",
    }, { name: "cert.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3, 4]) });

    expect(r.status).toBe(201);
    expect((r.json as { data: { pendingReview?: boolean } }).data.pendingReview).toBe(true);
    expect(cookieOf(r)).toBeUndefined(); // no session for pending teacher
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/"password"|\$2[aby]\$|tokenVersion|teacher-registration-requests\//i);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: em }, select: { id: true, role: true, status: true, teacherApprovalState: true, password: true } });
    expect(user.role).toBe("OPERATION");
    expect(user.status).toBe("INACTIVE");
    expect(user.teacherApprovalState).toBe("PENDING_REVIEW");
    expect(user.password).toMatch(/^\$2[aby]\$/);

    const req = await prisma.teacherRegistrationRequest.findFirstOrThrow({ where: { email: em } });
    expect(req.userId).toBe(user.id);
    const docs = req.proofDocuments as { originalName: string }[];
    expect(docs.length).toBe(1);
    expect(docs[0]!.originalName).toBe("cert.pdf");
  });
});

describe("Admin approval + login", () => {
  it("6-10. approve linked pending → user ACTIVE + APPROVED, password unchanged, no random pw", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: pending.id }, select: { password: true } });
    const r = await http("PATCH", `/api/admin/teacher-requests/${pendingReqId}/approve`, { cookie: adminCookie, body: { createAccount: true } });
    expect(r.status).toBe(200);
    const d = dataOf(r);
    expect(d.accountProvisioning).toBe("APPROVED_LINKED_USER_PAYMENT_REQUIRED");
    expect(d.paymentRequired).toBe(true);
    expect(d.userStatus).toBe("ACTIVE");
    expect(d.teacherApprovalState).toBe("APPROVED");
    expect(JSON.stringify(r.json)).not.toMatch(/"password"|\$2[aby]\$|tokenVersion/i);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: pending.id }, select: { status: true, teacherApprovalState: true, password: true } });
    expect(after.status).toBe("ACTIVE");
    expect(after.teacherApprovalState).toBe("APPROVED");
    expect(after.password).toBe(before.password); // unchanged, no random password
    // Audit log written.
    const log = await prisma.auditLog.findFirst({ where: { resourceId: pendingReqId, action: "TEACHER_REQUEST_APPROVED" } });
    expect(log).not.toBeNull();
  });

  it("11-12. approved unpaid teacher can login and gets TEACHER_PAYMENT_REQUIRED state", async () => {
    const r = await login(approvedUnpaid.email);
    expect(r.status).toBe(200);
    expect(cookieOf(r)).toBeTruthy();
    expect(dataOf(r).accessState).toBe("TEACHER_PAYMENT_REQUIRED");
  });

  it("13. pending teacher login blocked with TEACHER_PENDING_REVIEW", async () => {
    // `pending` was just approved above; use the freshly-registered pending teacher.
    const em = email("login-pending");
    await postForm("/api/v1/auth/register", { fullName: "Pending Teacher", email: em, mobile: mob(), password: PW, confirmPassword: PW, role: "OPERATION", subject: "Math" });
    const r = await login(em);
    expect(r.status).toBe(403);
    expect((r.json as { code?: string }).code).toBe("TEACHER_PENDING_REVIEW");
  });

  it("14. rejected teacher login blocked with TEACHER_REJECTED", async () => {
    const r = await login(rejected.email);
    expect(r.status).toBe(403);
    expect((r.json as { code?: string }).code).toBe("TEACHER_REJECTED");
  });

  it("active paid teacher login → ACTIVE_TEACHER state", async () => {
    const r = await login(activePaid.email);
    expect(r.status).toBe(200);
    expect(dataOf(r).accessState).toBe("ACTIVE_TEACHER");
  });
});

describe("Payment gate", () => {
  it("15-16 & 20. approved-unpaid: gated feature 403 PAYMENT_REQUIRED; plans endpoint OK; PENDING payment does not unlock", async () => {
    const cookie = cookieOf(await login(approvedUnpaid.email))!;
    const gated = await http("GET", GATED, { cookie });
    expect(gated.status).toBe(403);
    expect((gated.json as { code?: string }).code).toBe("TEACHER_PAYMENT_REQUIRED");
    const plans = await http("GET", UNGATED, { cookie });
    expect(plans.status).toBe(200); // ungated — reachable before payment
  });

  it("19 & 22. active-paid teacher (verified ACTIVE subscription) can access the gated feature", async () => {
    const cookie = cookieOf(await login(activePaid.email))!;
    const gated = await http("GET", GATED, { cookie });
    expect(gated.status).toBe(200);
  });
});

describe("Admin reject + compatibility", () => {
  it("23. reject linked pending sets user REJECTED + INACTIVE", async () => {
    const u = await makeUser("reject-flow", { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
    const reqId = await linkedRequest(u.id, "PENDING", u.email);
    const r = await http("PATCH", `/api/admin/teacher-requests/${reqId}/reject`, { cookie: adminCookie, body: { adminNotes: "no" } });
    expect(r.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { status: true, teacherApprovalState: true } });
    expect(after.status).toBe("INACTIVE");
    expect(after.teacherApprovalState).toBe("REJECTED");
  });

  it("25. admin teacher-requests list still works", async () => {
    const r = await http("GET", "/api/admin/teacher-requests?limit=100", { cookie: adminCookie });
    expect(r.status).toBe(200);
    expect(Array.isArray((dataOf(r).data as unknown[]))).toBe(true);
  });

  it("26 & 3. signed-url returns safe DOCUMENT_UNAVAILABLE for a doc with no storable path", async () => {
    // Register-with-file (test env → path null) then ask for its signed url.
    const em = email("sign");
    await postForm("/api/v1/auth/register", { fullName: "Sign Teacher", email: em, mobile: mob(), password: PW, confirmPassword: PW, role: "OPERATION", subject: "Chem" },
      { name: "proof.pdf", type: "application/pdf", bytes: new Uint8Array([9, 9]) });
    const req = await prisma.teacherRegistrationRequest.findFirstOrThrow({ where: { email: em }, select: { id: true } });
    const r = await http("GET", `/api/admin/teacher-requests/${req.id}/documents/0/signed-url`, { cookie: adminCookie });
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code).toBe("DOCUMENT_UNAVAILABLE");
    expect(JSON.stringify(r.json)).not.toMatch(/teacher-registration-requests\//);
  });
});

describe("Regression — student registration", () => {
  it("27. student registration still works and returns a session", async () => {
    const stageOwner = await makeUser("stageowner", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
    const stage = await prisma.stage.create({ data: { id: randomUUID(), name: `trd-stage-${RUN}`, sortOrder: 1, teacherId: stageOwner.id }, select: { id: true } });
    const em = email("student");
    const r = await http("POST", "/api/v1/auth/register", { body: { fullName: "Stud", email: em, mobile: mob(), password: PW, confirmPassword: PW, role: "STUDENT", stageId: stage.id } });
    expect(r.status).toBe(201);
    expect(cookieOf(r)).toBeTruthy();
    await prisma.studentProfile.deleteMany({ where: { stageId: stage.id } });
    await prisma.stage.delete({ where: { id: stage.id } });
  });
});
