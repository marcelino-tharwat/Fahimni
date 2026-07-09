import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the corrected teacher FREE-plan entitlement, registration tracking
 * reference, and admin proof-document visibility. Isolated test DB, self-owned
 * fixtures (unique run token), torn down afterwards. In the test environment
 * proof-document storage upload is skipped (metadata still recorded).
 *
 * Corrected policy under test: an APPROVED teacher WITHOUT an active paid
 * subscription is entitled to the FREE plan (full feature access, NOT blocked);
 * PENDING/FAILED payments neither upgrade nor remove FREE access; only a
 * Paymob-verified ACTIVE subscription is a paid plan.
 */

let server: Server;
let base: string;
const PW = "Teacher@1234";
const RUN = randomUUID().slice(0, 8);
const email = (label: string) => `tfp-${label}-${RUN}@e2e.test`;
let pwHash: string;
const mobiles = new Set<string>();
function mob(): string {
  let m: string;
  do { m = `010${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`; } while (mobiles.has(m));
  mobiles.add(m);
  return m;
}
const owned = {
  userIds: [] as string[], requestIds: [] as string[], planIds: [] as string[],
  subIds: [] as string[], subPayIds: [] as string[], stageIds: [] as string[],
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
async function postForm(path: string, fields: Record<string, string>, files: { name: string; type: string; bytes: Uint8Array }[] = []): Promise<Res> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of files) fd.append("proofDocuments", new Blob([f.bytes], { type: f.type }), f.name);
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
const dataOf = (r: Res) => r.json?.data as Record<string, unknown>;

async function makeUser(label: string, over: Record<string, unknown>): Promise<{ id: string; email: string }> {
  const u = await prisma.user.create({
    data: {
      id: randomUUID(), email: email(label), fullName: `TFP ${label}`, mobile: mob(),
      password: pwHash, role: "OPERATION", ...over,
    } as never,
    select: { id: true, email: true },
  });
  owned.userIds.push(u.id);
  return u;
}
async function linkedRequest(userId: string | null, status: "PENDING" | "APPROVED" | "REJECTED", em: string, proofDocuments: unknown[] = []): Promise<string> {
  const r = await prisma.teacherRegistrationRequest.create({
    data: {
      publicReference: `TFP-${RUN}-${owned.requestIds.length + 1}`,
      fullName: "TFP", email: em, mobile: mob(), status,
      proofDocuments: JSON.parse(JSON.stringify(proofDocuments)),
      ...(userId ? { userId } : {}),
    },
    select: { id: true },
  });
  owned.requestIds.push(r.id);
  return r.id;
}
async function pendingPayment(teacherId: string, planId: string, status: "PENDING" | "FAILED"): Promise<void> {
  const p = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId, planId, amount: 199, status, provider: "PAYMOB",
      providerOrderId: `tfp-${status}-${RUN}-${teacherId.slice(0, 6)}`,
    },
    select: { id: true },
  });
  owned.subPayIds.push(p.id);
}

let adminCookie: string, studentCookie: string;
let free: { id: string; email: string }, freePend: { id: string; email: string }, freeFail: { id: string; email: string };
let paid: { id: string; email: string }, pending: { id: string; email: string }, rejected: { id: string; email: string };
let paidPlanId: string;
let multiDocReqId: string;

const GATED = "/api/dashboard/teacher/stats";
const SUB_ME = "/api/teacher/subscription/me";

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await prisma.user.create({
    data: { id: randomUUID(), email: email("admin"), fullName: "TFP Admin", mobile: mob(), password: pwHash, role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  owned.userIds.push(admin.id);
  adminCookie = cookieOf(await login(admin.email))!;

  const student = await prisma.user.create({
    data: { id: randomUUID(), email: email("student"), fullName: "TFP Student", mobile: mob(), password: pwHash, role: "STUDENT", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  owned.userIds.push(student.id);
  studentCookie = cookieOf(await login(student.email))!;

  // Lifecycle teachers.
  free = await makeUser("free", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
  freePend = await makeUser("free-pend-pay", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
  freeFail = await makeUser("free-fail-pay", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
  paid = await makeUser("paid", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
  pending = await makeUser("pending", { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
  rejected = await makeUser("rejected", { status: "INACTIVE", teacherApprovalState: "REJECTED" });

  const plan = await prisma.teacherPlan.create({
    data: { code: `TFP-${RUN}`, name: "tfp", displayName: "TFP Plan", monthlyPrice: 199 },
    select: { id: true },
  });
  paidPlanId = plan.id;
  owned.planIds.push(plan.id);

  // Paid teacher: ACTIVE, non-lapsed subscription (Paymob-verified activation).
  const sub = await prisma.teacherSubscription.create({
    data: { teacherId: paid.id, planId: paidPlanId, status: "ACTIVE", billingInterval: "MONTHLY", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    select: { id: true },
  });
  owned.subIds.push(sub.id);

  // FREE teachers with unconfirmed / failed payments (must NOT upgrade or block).
  await pendingPayment(freePend.id, paidPlanId, "PENDING");
  await pendingPayment(freeFail.id, paidPlanId, "FAILED");

  // A linked PENDING request with a multi-document proof set (PDF + image + a doc
  // with no storable path → UNAVAILABLE) for the admin proof-visibility tests.
  multiDocReqId = await linkedRequest(pending.id, "PENDING", pending.email, [
    { originalName: "certificate.pdf", mimeType: "application/pdf", size: 2048, path: `tfp/${RUN}/certificate.pdf` },
    { originalName: "id-card.jpg", mimeType: "image/jpeg", size: 1024, path: `tfp/${RUN}/id-card.jpg` },
    { originalName: "extra.bin", mimeType: "application/octet-stream", size: 512 },
  ]);
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
  await prisma.stage.deleteMany({ where: { teacherId: { in: allUserIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("FREE-plan entitlement — /teacher/subscription/me", () => {
  it("1. approved teacher without a paid subscription resolves to the FREE plan", async () => {
    const cookie = cookieOf(await login(free.email))!;
    const r = await http("GET", SUB_ME, { cookie });
    expect(r.status).toBe(200);
    const b = r.json as Record<string, unknown>;
    expect(b.accessState).toBe("FREE_PLAN");
    expect(b.entitlementSource).toBe("DEFAULT_FREE_PLAN");
    expect(b.paymentRequired).toBe(false);
    expect(b.upgradeAvailable).toBe(true);
    expect((b.currentPlan as { code: string }).code).toBe("FREE");
    expect(b.subscription).toBeNull();
    expect(b.effectivePlanCode).toBe("FREE");
  });

  it("2. a PENDING payment does NOT upgrade — teacher stays FREE, payment surfaced", async () => {
    const cookie = cookieOf(await login(freePend.email))!;
    const r = await http("GET", SUB_ME, { cookie });
    expect(r.status).toBe(200);
    const b = r.json as Record<string, unknown>;
    expect(b.accessState).toBe("FREE_PLAN");
    expect(b.subscription).toBeNull();
    expect((b.pendingPayment as { status: string } | null)?.status).toBe("PENDING");
  });

  it("3. a FAILED payment does NOT upgrade and does NOT remove FREE access", async () => {
    const cookie = cookieOf(await login(freeFail.email))!;
    const r = await http("GET", SUB_ME, { cookie });
    expect(r.status).toBe(200);
    const b = r.json as Record<string, unknown>;
    expect(b.accessState).toBe("FREE_PLAN");
    expect(b.subscription).toBeNull();
  });

  it("4. approved teacher with an ACTIVE subscription resolves to PAID_PLAN", async () => {
    const cookie = cookieOf(await login(paid.email))!;
    const r = await http("GET", SUB_ME, { cookie });
    expect(r.status).toBe(200);
    const b = r.json as Record<string, unknown>;
    expect(b.accessState).toBe("PAID_PLAN");
    expect(b.entitlementSource).toBe("ACTIVE_SUBSCRIPTION");
    expect(b.upgradeAvailable).toBe(false);
    expect((b.subscription as { status: string }).status).toBe("ACTIVE");
  });
});

describe("Backend gate — FREE teachers are allowed, PENDING/REJECTED blocked", () => {
  it("5. approved FREE teacher reaches a gated feature (200)", async () => {
    const cookie = cookieOf(await login(free.email))!;
    expect((await http("GET", GATED, { cookie })).status).toBe(200);
  });

  it("6. FREE teacher with a PENDING payment still reaches a gated feature (200)", async () => {
    const cookie = cookieOf(await login(freePend.email))!;
    expect((await http("GET", GATED, { cookie })).status).toBe(200);
  });

  it("7. FREE teacher with a FAILED payment still reaches a gated feature (200)", async () => {
    const cookie = cookieOf(await login(freeFail.email))!;
    expect((await http("GET", GATED, { cookie })).status).toBe(200);
  });

  it("8. paid teacher reaches a gated feature (200)", async () => {
    const cookie = cookieOf(await login(paid.email))!;
    expect((await http("GET", GATED, { cookie })).status).toBe(200);
  });

  it("9. pending teacher login is blocked with TEACHER_PENDING_REVIEW", async () => {
    const r = await login(pending.email);
    expect(r.status).toBe(403);
    expect((r.json as { code?: string }).code).toBe("TEACHER_PENDING_REVIEW");
  });

  it("10. rejected teacher login is blocked with TEACHER_REJECTED", async () => {
    const r = await login(rejected.email);
    expect(r.status).toBe(403);
    expect((r.json as { code?: string }).code).toBe("TEACHER_REJECTED");
  });
});

describe("Registration tracking reference", () => {
  let trackRef: string, trackEmail: string, trackMobile: string;

  it("11. teacher registration returns a tracking reference (no secrets)", async () => {
    trackEmail = email("track");
    trackMobile = mob();
    const r = await postForm("/api/v1/auth/register", {
      fullName: "Track Teacher", email: trackEmail, mobile: trackMobile, password: PW, confirmPassword: PW, role: "OPERATION", subject: "Math",
    }, [{ name: "cert.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3]) }]);
    expect(r.status).toBe(201);
    trackRef = dataOf(r).trackingReference as string;
    expect(trackRef).toMatch(/^TR-\d{4}-/);
    expect(JSON.stringify(r.json)).not.toMatch(/"password"|\$2[aby]\$|tokenVersion/i);
  });

  it("12. track with reference + correct email returns safe status only", async () => {
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: trackRef, email: trackEmail } });
    expect(r.status).toBe(200);
    const b = dataOf(r);
    expect(b.reference).toBe(trackRef);
    expect(b.status).toBe("PENDING");
    expect(b.submittedAt).toBeTruthy();
    // No sensitive fields leaked.
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/adminNotes|reviewedById|reviewedBy|userId|proofDocuments|password|teacher-registration-requests\//i);
  });

  it("13. track with reference + correct mobile also works", async () => {
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: trackRef, mobile: trackMobile } });
    expect(r.status).toBe(200);
    expect(dataOf(r).status).toBe("PENDING");
  });

  it("14. track with reference + WRONG contact returns generic 404 (no enumeration)", async () => {
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: trackRef, email: email("wrong-contact") } });
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code).toBe("TEACHER_REQUEST_NOT_FOUND");
  });

  it("15. track with reference ONLY (no email/mobile) is rejected by validation", async () => {
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: trackRef } });
    expect(r.status).toBe(400);
  });

  it("16. track with an unknown reference returns the same generic 404", async () => {
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: "TR-2099-000000", email: trackEmail } });
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code).toBe("TEACHER_REQUEST_NOT_FOUND");
  });

  it("17. an approved request's tracking reflects APPROVED + reviewedAt", async () => {
    const em = email("track-approved");
    const mobile = mob();
    const reg = await postForm("/api/v1/auth/register", { fullName: "Track Approved", email: em, mobile, password: PW, confirmPassword: PW, role: "OPERATION", subject: "Sci" });
    const ref = dataOf(reg).trackingReference as string;
    const req = await prisma.teacherRegistrationRequest.findFirstOrThrow({ where: { email: em }, select: { id: true } });
    const appr = await http("PATCH", `/api/admin/teacher-requests/${req.id}/approve`, { cookie: adminCookie, body: { createAccount: true } });
    expect(appr.status).toBe(200);
    const r = await http("POST", "/api/teacher-registration-requests/track", { body: { reference: ref, email: em } });
    expect(r.status).toBe(200);
    expect(dataOf(r).status).toBe("APPROVED");
    expect(dataOf(r).reviewedAt).toBeTruthy();
  });
});

describe("Proof documents — admin visibility (safe)", () => {
  it("18. admin detail lists ALL documents with size + previewType (PDF/IMAGE/OTHER)", async () => {
    const r = await http("GET", `/api/admin/teacher-requests/${multiDocReqId}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const docs = dataOf(r).documents as { fileName: string; previewType: string; size: number | null; status: string }[];
    expect(docs.length).toBe(3);
    expect(docs[0]!.previewType).toBe("PDF");
    expect(docs[0]!.size).toBe(2048);
    expect(docs[0]!.status).toBe("AVAILABLE");
    expect(docs[1]!.previewType).toBe("IMAGE");
    expect(docs[2]!.previewType).toBe("OTHER");
    expect(docs[2]!.status).toBe("UNAVAILABLE"); // no storable path
  });

  it("19. admin detail never leaks raw storage paths", async () => {
    const r = await http("GET", `/api/admin/teacher-requests/${multiDocReqId}`, { cookie: adminCookie });
    expect(JSON.stringify(r.json)).not.toMatch(new RegExp(`tfp/${RUN}/`));
  });

  it("20. signed-url endpoint is ADMIN-only (401 anon, 403 student/teacher)", async () => {
    const url = `/api/admin/teacher-requests/${multiDocReqId}/documents/0/signed-url`;
    expect((await http("GET", url)).status).toBe(401);
    expect((await http("GET", url, { cookie: studentCookie })).status).toBe(403);
    const teacherCookie = cookieOf(await login(free.email))!;
    expect((await http("GET", url, { cookie: teacherCookie })).status).toBe(403);
  });

  it("21. signed-url for a doc with no storable path → DOCUMENT_UNAVAILABLE, no path leak", async () => {
    const r = await http("GET", `/api/admin/teacher-requests/${multiDocReqId}/documents/2/signed-url`, { cookie: adminCookie });
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code).toBe("DOCUMENT_UNAVAILABLE");
    expect(JSON.stringify(r.json)).not.toMatch(new RegExp(`tfp/${RUN}/`));
  });

  it("22. signed-url for an out-of-range index → DOCUMENT_UNAVAILABLE", async () => {
    const r = await http("GET", `/api/admin/teacher-requests/${multiDocReqId}/documents/99/signed-url`, { cookie: adminCookie });
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code).toBe("DOCUMENT_UNAVAILABLE");
  });
});

describe("Payment behavior unchanged (no fake activation)", () => {
  it("23. FREE teacher has NO subscription and NO SUCCESS payment", async () => {
    const subs = await prisma.teacherSubscription.count({ where: { teacherId: free.id } });
    const success = await prisma.teacherSubscriptionPayment.count({ where: { teacherId: free.id, status: "SUCCESS" } });
    expect(subs).toBe(0);
    expect(success).toBe(0);
  });

  it("24. the FREE teacher with a PENDING payment gained NO subscription (payment stays PENDING)", async () => {
    const subs = await prisma.teacherSubscription.count({ where: { teacherId: freePend.id } });
    const pending = await prisma.teacherSubscriptionPayment.count({ where: { teacherId: freePend.id, status: "PENDING" } });
    const success = await prisma.teacherSubscriptionPayment.count({ where: { teacherId: freePend.id, status: "SUCCESS" } });
    expect(subs).toBe(0);
    expect(pending).toBe(1);
    expect(success).toBe(0);
  });
});

describe("Regression — student registration", () => {
  it("25. student registration still works and returns a session", async () => {
    const stageOwner = await makeUser("stageowner", { status: "ACTIVE", teacherApprovalState: "APPROVED" });
    const stage = await prisma.stage.create({ data: { id: randomUUID(), name: `tfp-stage-${RUN}`, sortOrder: 1, teacherId: stageOwner.id }, select: { id: true } });
    owned.stageIds.push(stage.id);
    const em = email("reg-student");
    const r = await http("POST", "/api/v1/auth/register", { body: { fullName: "Stud", email: em, mobile: mob(), password: PW, confirmPassword: PW, role: "STUDENT", stageId: stage.id } });
    expect(r.status).toBe(201);
    expect(cookieOf(r)).toBeTruthy();
    await prisma.studentProfile.deleteMany({ where: { stageId: stage.id } });
  });
});
