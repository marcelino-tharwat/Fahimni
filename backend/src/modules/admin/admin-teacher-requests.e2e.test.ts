import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for Admin Teacher Registration Requests review. Isolated test DB with
 * self-owned fixtures. Never triggers external Supabase (signed-url tests use
 * empty/out-of-range documents which short-circuit before any storage call).
 */

let server: Server;
let base: string;
const PW = "TReq@1234";
let pwHash: string;

const owned = { userIds: [] as string[], requestIds: [] as string[] };

interface HttpResult { status: number; json: Record<string, unknown> | null; setCookie: string[]; }

async function http(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: HttpResult["json"] = null;
  try { json = (await res.json()) as HttpResult["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}

async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", email?: string): Promise<{ id: string; email: string }> {
  const finalEmail = email ?? `treq-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`;
  const u = await prisma.user.create({
    data: {
      email: finalEmail,
      fullName: `TReq ${role}`,
      mobile: `015${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
    select: { id: true, email: true },
  });
  owned.userIds.push(u.id);
  return u;
}

let refCounter = 0;
async function makeRequest(overrides: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  fullName?: string;
  email?: string;
  mobile?: string;
  subject?: string | null;
  proofDocuments?: unknown[];
  reviewedById?: string;
} = {}) {
  refCounter += 1;
  const r = await prisma.teacherRegistrationRequest.create({
    data: {
      publicReference: `TRREVIEW-${randomUUID().slice(0, 8)}-${refCounter}`,
      fullName: overrides.fullName ?? `Applicant ${randomUUID().slice(0, 4)}`,
      email: overrides.email ?? `applicant-${randomUUID().slice(0, 8)}@e2e.test`,
      mobile: overrides.mobile ?? `016${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      subject: overrides.subject === undefined ? "Mathematics" : overrides.subject,
      bio: "e2e applicant",
      status: overrides.status ?? "PENDING",
      proofDocuments: (overrides.proofDocuments ?? []) as never,
      ...(overrides.reviewedById ? { reviewedById: overrides.reviewedById, reviewedAt: new Date() } : {}),
    },
    select: { id: true, email: true, mobile: true, publicReference: true },
  });
  owned.requestIds.push(r.id);
  return r;
}

let adminCookie: string, teacherCookie: string, studentCookie: string;
const SECRET_PATH = "teacher-registration-requests/SECRET_STORAGE_KEY_should-not-leak.pdf";
const searchToken = `ZSRCH${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN");
  const teacher = await makeUser("OPERATION");
  const student = await makeUser("STUDENT");
  adminCookie = await login(admin.email);
  teacherCookie = await login(teacher.email);
  studentCookie = await login(student.email);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: owned.requestIds } } });
  await prisma.teacherRegistrationRequest.deleteMany({ where: { id: { in: owned.requestIds } } });
  // Delete teacher profiles + users created by approvals or fixtures.
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const g = (p: string, cookie = adminCookie) => http("GET", p, { cookie });
const dataOf = (r: HttpResult) => r.json?.data as Record<string, unknown>;

describe("Admin Teacher Requests — authorization", () => {
  it("1. ADMIN can list requests (200)", async () => {
    expect((await g(`/api/admin/teacher-requests`)).status).toBe(200);
  });
  it("2. unauthenticated denied (401)", async () => {
    expect((await http("GET", `/api/admin/teacher-requests`)).status).toBe(401);
  });
  it("3. STUDENT denied (403)", async () => {
    expect((await g(`/api/admin/teacher-requests`, studentCookie)).status).toBe(403);
  });
  it("4. OPERATION denied (403)", async () => {
    expect((await g(`/api/admin/teacher-requests`, teacherCookie)).status).toBe(403);
  });
});

describe("Admin Teacher Requests — list / detail / documents", () => {
  it("5. status filter works", async () => {
    await makeRequest({ status: "PENDING" });
    const r = await g(`/api/admin/teacher-requests?status=REJECTED&limit=100`);
    const rows = dataOf(r).data as { status: string }[];
    expect(rows.every((x) => x.status === "REJECTED")).toBe(true);
  });

  it("6. search works by reference/email", async () => {
    const req = await makeRequest({ fullName: `${searchToken} Applicant`, email: `${searchToken.toLowerCase()}@e2e.test` });
    const r = await g(`/api/admin/teacher-requests?q=${encodeURIComponent(searchToken)}`);
    const rows = dataOf(r).data as { id: string }[];
    expect(rows.some((x) => x.id === req.id)).toBe(true);
    expect(rows.length).toBe(1);
  });

  it("7 & 8. detail returns safe fields and never leaks raw proof paths", async () => {
    const req = await makeRequest({
      proofDocuments: [{ originalName: "cert.pdf", mimeType: "application/pdf", size: 1234, path: SECRET_PATH }],
    });
    const r = await g(`/api/admin/teacher-requests/${req.id}`);
    expect(r.status).toBe(200);
    const d = dataOf(r) as { request: { publicReference: string }; documents: { fileName: string; status: string }[] };
    expect(d.request.publicReference).toBe(req.publicReference);
    expect(d.documents.length).toBe(1);
    expect(d.documents[0]!.fileName).toBe("cert.pdf");
    expect(d.documents[0]!.status).toBe("AVAILABLE");
    // The raw storage key/path must NOT appear anywhere in the response.
    expect(JSON.stringify(r.json)).not.toMatch(/SECRET_STORAGE_KEY|proofDocuments|"path"/i);
  });

  it("detail 404 for malformed / missing id", async () => {
    expect((await g(`/api/admin/teacher-requests/not-a-uuid`)).status).toBe(404);
    expect((await g(`/api/admin/teacher-requests/${randomUUID()}`)).status).toBe(404);
  });

  it("9. signed-url endpoint is ADMIN-only", async () => {
    const req = await makeRequest();
    expect((await http("GET", `/api/admin/teacher-requests/${req.id}/documents/0/signed-url`)).status).toBe(401);
    expect((await g(`/api/admin/teacher-requests/${req.id}/documents/0/signed-url`, studentCookie)).status).toBe(403);
    expect((await g(`/api/admin/teacher-requests/${req.id}/documents/0/signed-url`, teacherCookie)).status).toBe(403);
  });

  it("10. signed-url returns safe DOCUMENT_UNAVAILABLE for missing docs (no external call)", async () => {
    const req = await makeRequest({ proofDocuments: [] });
    const r = await g(`/api/admin/teacher-requests/${req.id}/documents/0/signed-url`);
    expect(r.status).toBe(404);
    expect((r.json as { code?: string }).code ?? (r.json as Record<string, unknown>).message).toBeDefined();
    expect(JSON.stringify(r.json)).not.toMatch(/SECRET_STORAGE_KEY|\/teacher-registration-requests\//);
  });
});

describe("Admin Teacher Requests — approve", () => {
  it("11 & 12. approve a pending request creates the teacher and sets reviewer fields", async () => {
    const req = await makeRequest();
    const r = await http("PATCH", `/api/admin/teacher-requests/${req.id}/approve`, {
      cookie: adminCookie,
      body: { adminNotes: "looks good", createAccount: true },
    });
    expect(r.status).toBe(200);
    const d = dataOf(r) as { accountProvisioning: string; createdTeacherId: string | null; request: { status: string } };
    expect(d.request.status).toBe("APPROVED");
    expect(d.accountProvisioning).toBe("CREATED_PENDING_PASSWORD_RESET");
    expect(d.createdTeacherId).toBeTruthy();
    if (d.createdTeacherId) owned.userIds.push(d.createdTeacherId);

    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("APPROVED");
    expect(row.reviewedById).toBeTruthy();
    expect(row.reviewedAt).not.toBeNull();

    // The created user is an OPERATION teacher with a profile — and no password leaked.
    const created = await prisma.user.findUniqueOrThrow({ where: { id: d.createdTeacherId! }, select: { role: true, email: true } });
    expect(created.role).toBe("OPERATION");
    expect(created.email).toBe(req.email);
    // No password field/hash or tokenVersion is returned. (The provisioning label
    // "CREATED_PENDING_PASSWORD_RESET" is a status, not a secret — matched narrowly.)
    expect(JSON.stringify(r.json)).not.toMatch(/"password"|passwordHash|tokenVersion|\$2[aby]\$/i);
  });

  it("13. approve writes an AuditLog", async () => {
    const req = await makeRequest();
    const r = await http("PATCH", `/api/admin/teacher-requests/${req.id}/approve`, { cookie: adminCookie, body: { createAccount: true } });
    const d = dataOf(r) as { createdTeacherId: string | null };
    if (d.createdTeacherId) owned.userIds.push(d.createdTeacherId);
    const log = await prisma.auditLog.findFirst({ where: { resourceId: req.id, action: "TEACHER_REQUEST_APPROVED" } });
    expect(log).not.toBeNull();
  });

  it("14. approve handles an email conflict safely (no duplicate user)", async () => {
    const existing = await makeUser("STUDENT");
    const req = await makeRequest({ email: existing.email });
    const r = await http("PATCH", `/api/admin/teacher-requests/${req.id}/approve`, { cookie: adminCookie, body: { createAccount: true } });
    expect(r.status).toBe(200);
    const d = dataOf(r) as { accountProvisioning: string; conflictReason: string | null };
    expect(d.accountProvisioning).toBe("CONFLICT");
    expect(d.conflictReason).toBeTruthy();
    // No second user with that email was created — still exactly one (the student).
    const count = await prisma.user.count({ where: { email: existing.email } });
    expect(count).toBe(1);
    // Request is still approved.
    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("APPROVED");
  });

  it("approve with createAccount=false approves without creating a user", async () => {
    const req = await makeRequest();
    const r = await http("PATCH", `/api/admin/teacher-requests/${req.id}/approve`, { cookie: adminCookie, body: { createAccount: false } });
    const d = dataOf(r) as { accountProvisioning: string; createdTeacherId: string | null };
    expect(d.accountProvisioning).toBe("SKIPPED");
    expect(d.createdTeacherId).toBeNull();
    expect(await prisma.user.count({ where: { email: req.email } })).toBe(0);
  });

  it("15. cannot approve an already-APPROVED / REJECTED request", async () => {
    const approved = await makeRequest({ status: "APPROVED" });
    const rejected = await makeRequest({ status: "REJECTED" });
    expect((await http("PATCH", `/api/admin/teacher-requests/${approved.id}/approve`, { cookie: adminCookie, body: { createAccount: false } })).status).toBe(409);
    expect((await http("PATCH", `/api/admin/teacher-requests/${rejected.id}/approve`, { cookie: adminCookie, body: { createAccount: false } })).status).toBe(409);
  });
});

describe("Admin Teacher Requests — reject", () => {
  it("16 & 18. reject a pending request sets status + reviewer fields", async () => {
    const req = await makeRequest();
    const r = await http("PATCH", `/api/admin/teacher-requests/${req.id}/reject`, { cookie: adminCookie, body: { adminNotes: "insufficient proof" } });
    expect(r.status).toBe(200);
    expect((dataOf(r).request as { status: string }).status).toBe("REJECTED");
    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.reviewedById).toBeTruthy();
    expect(row.reviewedAt).not.toBeNull();
    expect(row.adminNotes).toBe("insufficient proof");
  });

  it("17. reject requires adminNotes", async () => {
    const req = await makeRequest();
    expect((await http("PATCH", `/api/admin/teacher-requests/${req.id}/reject`, { cookie: adminCookie, body: {} })).status).toBe(400);
    expect((await http("PATCH", `/api/admin/teacher-requests/${req.id}/reject`, { cookie: adminCookie, body: { adminNotes: "  " } })).status).toBe(400);
    // Still pending after failed rejects.
    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("PENDING");
  });

  it("19. reject writes an AuditLog", async () => {
    const req = await makeRequest();
    await http("PATCH", `/api/admin/teacher-requests/${req.id}/reject`, { cookie: adminCookie, body: { adminNotes: "no" } });
    const log = await prisma.auditLog.findFirst({ where: { resourceId: req.id, action: "TEACHER_REQUEST_REJECTED" } });
    expect(log).not.toBeNull();
  });

  it("cannot reject a non-pending request", async () => {
    const approved = await makeRequest({ status: "APPROVED" });
    expect((await http("PATCH", `/api/admin/teacher-requests/${approved.id}/reject`, { cookie: adminCookie, body: { adminNotes: "x" } })).status).toBe(409);
  });
});

describe("Public teacher registration request — regression", () => {
  it("20. public submission endpoint is still mounted and validates (not 404)", async () => {
    // Empty body → the route runs (multer + validation) and returns 400, proving
    // the public endpoint is intact. (A full multipart upload would hit Supabase.)
    const r = await http("POST", "/api/teacher-registration-requests", { body: {} });
    expect(r.status).not.toBe(404);
    expect([400, 422]).toContain(r.status);
  });
});
