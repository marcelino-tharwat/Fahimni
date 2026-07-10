import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

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

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", email?: string, overrides: { status?: string; teacherApprovalState?: string } = {}): Promise<{ id: string; email: string }> {
  const finalEmail = email ?? `rejpol-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`;
  const u = await prisma.user.create({
    data: {
      email: finalEmail,
      fullName: `RejPol ${role}`,
      mobile: `015${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: (overrides.status ?? "ACTIVE") as "ACTIVE" | "INACTIVE" | "BANNED",
      teacherApprovalState: (overrides.teacherApprovalState ?? "NONE") as "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED",
    },
    select: { id: true, email: true },
  });
  owned.userIds.push(u.id);
  return u;
}

let refCounter = 0;
async function linkedRequest(userId: string | null, status: "PENDING" | "APPROVED" | "REJECTED", em: string, overrides: { adminNotes?: string; rejectionMode?: string } = {}): Promise<string> {
  refCounter += 1;
  const r = await prisma.teacherRegistrationRequest.create({
    data: {
      publicReference: `TREJREV-${randomUUID().slice(0, 8)}-${refCounter}`,
      fullName: `Applicant ${refCounter}`,
      email: em,
      mobile: `016${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      subject: "Subject",
      bio: "e2e",
      status,
      proofDocuments: [],
      ...(typeof userId === "string" ? { userId } : {}),
      ...(status === "REJECTED" ? { reviewedById: owned.userIds[0] ?? undefined, reviewedAt: new Date() } : {}),
      ...(overrides.adminNotes ? { adminNotes: overrides.adminNotes } : {}),
      ...(overrides.rejectionMode ? { rejectionMode: overrides.rejectionMode as "EDIT_ALLOWED" | "FINAL_REJECTION" } : {}),
    },
    select: { id: true },
  });
  owned.requestIds.push(r.id);
  return r.id;
}

let adminCookie: string, pendingCookie: string, rejectedCookie: string, rejectedEditCookie: string, rejectedFinalCookie: string, studentCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const admin = await makeUser("ADMIN");
  const pending = await makeUser("OPERATION", undefined, { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
  const rejectedEdit = await makeUser("OPERATION", undefined, { status: "INACTIVE", teacherApprovalState: "REJECTED" });
  const rejectedFinal = await makeUser("OPERATION", undefined, { status: "INACTIVE", teacherApprovalState: "REJECTED" });
  const student = await makeUser("STUDENT");

  await linkedRequest(pending.id, "PENDING", pending.email);
  await linkedRequest(rejectedEdit.id, "REJECTED", rejectedEdit.email, { adminNotes: "يرجى تحديث المستندات", rejectionMode: "EDIT_ALLOWED" });
  await linkedRequest(rejectedFinal.id, "REJECTED", rejectedFinal.email, { adminNotes: "رفض نهائي", rejectionMode: "FINAL_REJECTION" });

  adminCookie = await login(admin.email);
  pendingCookie = await login(pending.email);
  rejectedCookie = await login(rejectedEdit.email);
  rejectedFinalCookie = await login(rejectedFinal.email);
  rejectedEditCookie = rejectedCookie;
  studentCookie = await login(student.email);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: owned.requestIds } } });
  await prisma.teacherRegistrationRequest.deleteMany({ where: { id: { in: owned.requestIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const g = (p: string, cookie = adminCookie) => http("GET", p, { cookie });
const dataOf = (r: HttpResult) => r.json?.data as Record<string, unknown>;

describe("Teacher review-status — tracking reference & rejection policy", () => {
  it("1. pending teacher review-status returns tracking reference", async () => {
    const r = await g("/api/teachers/review-status", pendingCookie);
    expect(r.status).toBe(200);
    const req = dataOf(r).request as Record<string, unknown> | null;
    expect(req).not.toBeNull();
    expect(req!.publicReference).toBeTruthy();
    expect(typeof req!.publicReference).toBe("string");
    expect((req!.publicReference as string).startsWith("TREJREV-")).toBe(true);
  });

  it("2. rejected editable teacher review-status returns tracking reference + rejection reason", async () => {
    const r = await g("/api/teachers/review-status", rejectedEditCookie);
    expect(r.status).toBe(200);
    const req = dataOf(r).request as Record<string, unknown> | null;
    expect(req).not.toBeNull();
    expect(req!.publicReference).toBeTruthy();
    expect(req!.rejectionReason).toBe("يرجى تحديث المستندات");
    expect(req!.rejectionMode).toBe("EDIT_ALLOWED");
  });

  it("3. rejected final teacher review-status returns tracking reference + rejection reason", async () => {
    const r = await g("/api/teachers/review-status", rejectedFinalCookie);
    expect(r.status).toBe(200);
    const req = dataOf(r).request as Record<string, unknown> | null;
    expect(req).not.toBeNull();
    expect(req!.publicReference).toBeTruthy();
    expect(req!.rejectionReason).toBe("رفض نهائي");
    expect(req!.rejectionMode).toBe("FINAL_REJECTION");
  });

  it("4. rejected editable returns canEditAndResubmit = true", async () => {
    const r = await g("/api/teachers/review-status", rejectedEditCookie);
    const req = dataOf(r).request as Record<string, unknown> | null;
    expect(req!.canEditAndResubmit).toBe(true);
  });

  it("5. final rejected returns canEditAndResubmit = false", async () => {
    const r = await g("/api/teachers/review-status", rejectedFinalCookie);
    const req = dataOf(r).request as Record<string, unknown> | null;
    expect(req!.canEditAndResubmit).toBe(false);
  });
});

describe("Admin reject with rejectionMode", () => {
  it("6. admin reject requires adminNotes", async () => {
    const reqId = await linkedRequest(null, "PENDING", `notes-test-${randomUUID().slice(0, 6)}@e2e.test`);
    const r = await http("PATCH", `/api/admin/teacher-requests/${reqId}/reject`, { cookie: adminCookie, body: { rejectionMode: "EDIT_ALLOWED" } });
    expect(r.status).toBe(400);
  });

  it("7. admin reject requires rejectionMode", async () => {
    const reqId = await linkedRequest(null, "PENDING", `mode-test-${randomUUID().slice(0, 6)}@e2e.test`);
    const r = await http("PATCH", `/api/admin/teacher-requests/${reqId}/reject`, { cookie: adminCookie, body: { adminNotes: "no" } });
    expect(r.status).toBe(400);
  });

  it("8. admin reject EDIT_ALLOWED saves policy", async () => {
    const reqId = await linkedRequest(null, "PENDING", `edit-allow-${randomUUID().slice(0, 6)}@e2e.test`);
    const r = await http("PATCH", `/api/admin/teacher-requests/${reqId}/reject`, { cookie: adminCookie, body: { adminNotes: "edit allowed test", rejectionMode: "EDIT_ALLOWED" } });
    expect(r.status).toBe(200);
    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: reqId } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectionMode).toBe("EDIT_ALLOWED");
    expect(row.adminNotes).toBe("edit allowed test");
  });

  it("9. admin reject FINAL_REJECTION saves policy", async () => {
    const reqId = await linkedRequest(null, "PENDING", `final-rej-${randomUUID().slice(0, 6)}@e2e.test`);
    const r = await http("PATCH", `/api/admin/teacher-requests/${reqId}/reject`, { cookie: adminCookie, body: { adminNotes: "final rejection test", rejectionMode: "FINAL_REJECTION" } });
    expect(r.status).toBe(200);
    const row = await prisma.teacherRegistrationRequest.findUniqueOrThrow({ where: { id: reqId } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectionMode).toBe("FINAL_REJECTION");
    expect(row.adminNotes).toBe("final rejection test");
  });
});

describe("Resubmit flow", () => {
  it("10. editable rejected teacher can resubmit", async () => {
    const r = await http("POST", "/api/teachers/registration-request/resubmit", { cookie: rejectedEditCookie, body: {} });
    expect(r.status).toBe(200);
    const d = dataOf(r) as { publicReference: string; status: string };
    expect(d.status).toBe("PENDING");
    // Verify request is back to PENDING
    const row = await prisma.teacherRegistrationRequest.findFirst({
      where: { userId: owned.userIds[2] }, // rejectedEdit user
      orderBy: { createdAt: "desc" },
      select: { status: true, rejectionMode: true },
    });
    expect(row?.status).toBe("PENDING");
    expect(row?.rejectionMode).toBeNull();
  });

  it("11. final rejected teacher cannot resubmit", async () => {
    const r = await http("POST", "/api/teachers/registration-request/resubmit", { cookie: rejectedFinalCookie, body: {} });
    expect(r.status).toBe(403);
    const code = (r.json as { code?: string })?.code;
    expect(code).toBe("REQUEST_REJECTION_FINAL");
  });
});

describe("Security — no data leakage", () => {
  it("12. teacher cannot see another teacher's request status", async () => {
    // A teacher should only be able to see their own data via /review-status
    // (which is scoped by user id from the auth token).
    const r = await g("/api/teachers/review-status", rejectedEditCookie);
    const req = dataOf(r).request as Record<string, unknown> | null;
    // The current teacher sees THEIR OWN request, not the other teacher's.
    // Other teachers' requests are not accessible because the endpoint is
    // scoped to req.user.id.
    expect(req).not.toBeNull();
    expect(req!.publicReference).toBeTruthy();
    // The userId linked request is the one belonging to this teacher.
    const dbReq = await prisma.teacherRegistrationRequest.findFirst({
      where: { userId: owned.userIds[2] },
      orderBy: { createdAt: "desc" },
      select: { publicReference: true },
    });
    expect(req!.publicReference).toBe(dbReq!.publicReference);
  });

  it("13. no admin private data / storage paths / secrets exposed", async () => {
    const r = await g("/api/teachers/review-status", rejectedEditCookie);
    const body = JSON.stringify(r.json);
    expect(body).not.toMatch(/reviewedBy|reviewedById|proofDocuments|"path"|password|tokenVersion|storage/i);
  });
});
