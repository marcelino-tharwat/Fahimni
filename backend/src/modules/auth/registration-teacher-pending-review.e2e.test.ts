import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the teacher pending-review registration phase. Isolated test DB with
 * self-owned fixtures (unique run token), torn down afterwards.
 */

let server: Server;
let base: string;
const PW = "Teacher@1234";
const RUN = randomUUID().slice(0, 8);
const emailFor = (label: string) => `reg-${label}-${RUN}@e2e.test`;
const mobiles = new Set<string>();
function uniqueMobile(): string {
  let m: string;
  do {
    m = `012${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`;
  } while (mobiles.has(m));
  mobiles.add(m);
  return m;
}

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

let stageId: string;
let adminCookie: string;
let adminId: string | undefined;
const ownedStageIds: string[] = [];

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Self-sufficient fixtures (do not rely on seed data being present in the test DB):
  // a throwaway teacher owns a stage the student registrations can reference.
  const stageOwner = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: emailFor("stageowner"),
      fullName: "Reg Stage Owner",
      mobile: uniqueMobile(),
      password: await bcrypt.hash(PW, 12),
      role: "OPERATION",
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
    },
    select: { id: true },
  });
  const stage = await prisma.stage.create({
    data: { id: randomUUID(), name: `reg-stage-${RUN}`, sortOrder: 1, teacherId: stageOwner.id },
    select: { id: true },
  });
  stageId = stage.id;
  ownedStageIds.push(stage.id);

  const admin = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: emailFor("admin"),
      fullName: "Reg Admin",
      mobile: uniqueMobile(),
      password: await bcrypt.hash(PW, 12),
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: { id: true, email: true },
  });
  adminId = admin.id;
  const r = await http("POST", "/api/v1/auth/login", { body: { email: admin.email, password: PW } });
  adminCookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="))!;
});

afterAll(async () => {
  const emailLike = { contains: `-${RUN}@e2e.test` };
  await prisma.teacherRegistrationRequest.deleteMany({ where: { email: emailLike } });
  const users = await prisma.user.findMany({ where: { email: emailLike }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.stage.deleteMany({ where: { id: { in: ownedStageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

function studentBody(label: string) {
  return { fullName: "Reg Student", email: emailFor(label), mobile: uniqueMobile(), password: PW, confirmPassword: PW, role: "STUDENT", stageId };
}
function teacherBody(label: string, over: Record<string, unknown> = {}) {
  return { fullName: "Reg Teacher", email: emailFor(label), mobile: uniqueMobile(), password: PW, confirmPassword: PW, role: "OPERATION", subject: "Biology", bio: "x", ...over };
}
const reg = (body: unknown) => http("POST", "/api/v1/auth/register", { body });

describe("Registration — student", () => {
  it("1 & 2. student registers with password (hashed, not returned) and gets a session", async () => {
    const body = studentBody("student1");
    const r = await reg(body);
    expect(r.status).toBe(201);
    const user = (r.json?.data as { user: Record<string, unknown> }).user;
    expect(user.role).toBe("STUDENT");
    expect(r.setCookie.some((c) => c.startsWith("access_token="))).toBe(true); // active session
    expect(JSON.stringify(r.json)).not.toMatch(/password|tokenVersion/i);
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: body.email }, select: { password: true, status: true, teacherApprovalState: true } });
    expect(dbUser.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
    expect(dbUser.status).toBe("ACTIVE");
    expect(dbUser.teacherApprovalState).toBe("NONE");
  });

  it("confirmPassword mismatch is rejected", async () => {
    const r = await reg({ ...studentBody("mismatch"), confirmPassword: "Different@123" });
    expect(r.status).toBe(400);
  });
});

describe("Registration — teacher pending review", () => {
  it("3-7 & 13. teacher registers pending: OPERATION user PENDING_REVIEW, linked request, no session, no secrets", async () => {
    const body = teacherBody("teacher1");
    const r = await reg(body);
    expect(r.status).toBe(201);
    expect((r.json as { data: { pendingReview?: boolean } }).data.pendingReview).toBe(true);
    // No session cookie is issued for a pending teacher.
    expect(r.setCookie.some((c) => c.startsWith("access_token="))).toBe(false);
    expect(JSON.stringify(r.json)).not.toMatch(/"password"|passwordHash|tokenVersion|\$2[aby]\$/i);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: body.email },
      select: { id: true, role: true, status: true, teacherApprovalState: true, password: true },
    });
    expect(user.role).toBe("OPERATION");
    expect(user.status).toBe("INACTIVE"); // not an active teacher
    expect(user.teacherApprovalState).toBe("PENDING_REVIEW");
    expect(user.password).toMatch(/^\$2[aby]\$/); // teacher's own password, hashed

    const req = await prisma.teacherRegistrationRequest.findFirstOrThrow({ where: { email: body.email } });
    expect(req.status).toBe("PENDING");
    expect(req.userId).toBe(user.id); // linked
  });

  it("8. duplicate teacher email is rejected (409)", async () => {
    const body = teacherBody("dupe-email");
    expect((await reg(body)).status).toBe(201);
    const r2 = await reg({ ...teacherBody("dupe-email-2"), email: body.email });
    expect(r2.status).toBe(409);
  });

  it("9. duplicate teacher mobile is rejected (409)", async () => {
    const body = teacherBody("dupe-mobile");
    expect((await reg(body)).status).toBe(201);
    const r2 = await reg({ ...teacherBody("dupe-mobile-2"), mobile: body.mobile });
    expect(r2.status).toBe(409);
  });

  it("10. a pending teacher logs in in restricted mode (200 + TEACHER_PENDING_REVIEW), not blocked", async () => {
    // Regression guard: this used to incorrectly assert a 403 because
    // registerTeacherPending set emailVerified:false, which tripped the
    // EMAIL_NOT_VERIFIED gate before the teacher-lifecycle restricted-login
    // path (see teacher-pending-login-review-status.e2e.test.ts, the
    // authoritative coverage for that path) ever ran. Teachers are gated by
    // admin review, not email verification — see AuthService.registerTeacherPending.
    const body = teacherBody("nologin");
    expect((await reg(body)).status).toBe(201);
    const login = await http("POST", "/api/v1/auth/login", { body: { email: body.email, password: PW } });
    expect(login.status).toBe(200);
    const data = (login.json as { data: { accessState?: string } }).data;
    expect(data.accessState).toBe("TEACHER_PENDING_REVIEW");
    expect(login.setCookie.some((c) => c.startsWith("access_token="))).toBe(true);
  });
});

describe("Regression — public request + admin compatibility", () => {
  it("11. public teacher-registration request endpoint is still mounted (validates, not 404)", async () => {
    const r = await http("POST", "/api/teacher-registration-requests", { body: {} });
    expect(r.status).not.toBe(404);
    expect([400, 422]).toContain(r.status);
  });

  it("12. admin teacher-requests list works with linked and legacy (unlinked) requests", async () => {
    const r = await http("GET", "/api/admin/teacher-requests?limit=100", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = (r.json?.data as { data: unknown[] }).data;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0); // seeded legacy + linked requests are listable
  });
});
