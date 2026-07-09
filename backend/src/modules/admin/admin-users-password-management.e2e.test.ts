import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "AdminPwdMgmt@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
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
  return { status: res.status, json };
}

async function login(email: string, password = PW): Promise<string> {
  const rawRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = rawRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0]?.trim();
  if (!cookie || !cookie.startsWith("access_token=")) {
    throw new Error(`login failed for ${email}: status ${rawRes.status}`);
  }
  return cookie;
}

async function makeUser(
  role: "ADMIN" | "OPERATION" | "STUDENT",
  overrides: {
    fullName?: string;
    status?: "ACTIVE" | "INACTIVE" | "BANNED";
    teacherApprovalState?: "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  } = {},
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `au-pwd-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: overrides.fullName ?? `AU Pwd ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `019${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: overrides.status ?? "ACTIVE",
      teacherApprovalState: overrides.teacherApprovalState ?? "NONE",
    },
  });
  owned.userIds.push(id);
  return id;
}

let adminCookie: string;
let studentCookie: string;
let teacherCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 10);

  const app = createApp();
  server = app.listen(0);
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  // Ensure an admin user exists for login
  const adminId = randomUUID();
  const adminEmail = `au-pwd-admin-${randomUUID().slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id: adminId,
      email: adminEmail,
      fullName: "Pwd Admin",
      mobile: `019${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
      password: pwHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  owned.userIds.push(adminId);
  adminCookie = await login(adminEmail);

  // Student
  const studentId = await makeUser("STUDENT");
  const studentEmail = (await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { email: true } })).email;
  studentCookie = await login(studentEmail!);

  // Teacher
  const teacherId = await makeUser("OPERATION", { teacherApprovalState: "APPROVED" });
  const teacherEmail = (await prisma.user.findUniqueOrThrow({ where: { id: teacherId }, select: { email: true } })).email;
  teacherCookie = await login(teacherEmail!);

  // Ensure a stage exists for student profiles
  const existingStage = await prisma.stage.findFirst({ select: { id: true } });
  if (!existingStage) {
    const stageId = randomUUID();
    await prisma.stage.create({
      data: { id: stageId, name: `pwd-e2e-stage-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId: adminId },
    });
    owned.stageIds.push(stageId);
  }
});

afterAll(async () => {
  // Clean up in dependency order
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.otp.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.quizAttempt.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function patch(path: string, body: unknown, cookie?: string) {
  return http("PATCH", `/api${path}`, { body, cookie: cookie ?? adminCookie });
}

async function post(path: string, body: unknown, cookie?: string) {
  return http("POST", `/api${path}`, { body, cookie: cookie ?? adminCookie });
}

const NEW_PW = "NewStr0ng@Pass";
const WEAK_PW = "weak";

describe("Admin password management", () => {
  it("1. ADMIN resets active student password", async () => {
    const studentId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Password reset by admin for testing",
    });
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    expect(body.data).toBeDefined();
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBe(studentId);
  });

  it("2. old password fails after reset", async () => {
    const studentId = await makeUser("STUDENT");
    // Reset the password
    await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing old password invalidation",
    });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { email: true } })).email;
    // Try to login with old password
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: PW },
    });
    expect(r.status).toBe(401);
  });

  it("3. new password works", async () => {
    const studentId = await makeUser("STUDENT");
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { email: true } })).email;
    // Reset the password
    await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing new password",
    });
    // Login with new password
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: NEW_PW },
    });
    expect(r.status).toBe(200);
  });

  it("4. password hash changed", async () => {
    const studentId = await makeUser("STUDENT");
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { password: true },
    });
    await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing hash change",
    });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { password: true },
    });
    expect(after.password).not.toBe(before.password);
  });

  it("5. response does not expose hash/tokenVersion", async () => {
    const studentId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing secrets leak",
    });
    expect(r.status).toBe(200);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/:password|passwordHash|tokenVersion|refreshToken/i);
  });

  it("6. forceLogout increments tokenVersion if supported", async () => {
    const studentId = await makeUser("STUDENT");
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { tokenVersion: true },
    });
    await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: true,
      reason: "Testing force logout",
    });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { tokenVersion: true },
    });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
  });

  it("7. banned user remains blocked after password reset", async () => {
    const bannedId = await makeUser("STUDENT", { status: "BANNED" });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: bannedId }, select: { email: true } })).email;
    // Reset password
    await patch(`/admin/users/${bannedId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing banned user",
    });
    // Try to login
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: NEW_PW },
    });
    expect(r.status).toBe(403);
  });

  it("8. pending teacher remains blocked after password reset", async () => {
    const pendingId = await makeUser("OPERATION", { teacherApprovalState: "PENDING_REVIEW", status: "INACTIVE" });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: pendingId }, select: { email: true } })).email;
    // Reset password
    await patch(`/admin/users/${pendingId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing pending teacher",
    });
    // Try to login
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: NEW_PW },
    });
    expect(r.status).toBe(403);
    const body = r.json as Record<string, unknown>;
    expect(body.code ?? JSON.stringify(body)).toMatch(/TEACHER_PENDING_REVIEW/);
  });

  it("9. rejected teacher remains blocked after password reset", async () => {
    const rejectedId = await makeUser("OPERATION", { teacherApprovalState: "REJECTED", status: "INACTIVE" });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: rejectedId }, select: { email: true } })).email;
    // Reset password
    await patch(`/admin/users/${rejectedId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing rejected teacher",
    });
    // Try to login
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: NEW_PW },
    });
    expect(r.status).toBe(403);
    const body = r.json as Record<string, unknown>;
    expect(body.code ?? JSON.stringify(body)).toMatch(/TEACHER_REJECTED/);
  });

  it("10. approved teacher login follows current FREE/PAID policy", async () => {
    const approvedId = await makeUser("OPERATION", { teacherApprovalState: "APPROVED" });
    await prisma.teacherProfile.upsert({
      where: { userId: approvedId },
      update: {},
      create: { userId: approvedId, subject: "Math" },
    });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: approvedId }, select: { email: true } })).email;
    // Reset password
    await patch(`/admin/users/${approvedId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing approved teacher",
    });
    // Login should succeed (free teacher policy)
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email, password: NEW_PW },
    });
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    const data = body.data as Record<string, unknown> | undefined;
    expect(data?.accessState).toMatch(/FREE_TEACHER|ACTIVE_TEACHER/);
  });

  it("11. weak password rejected", async () => {
    const studentId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${studentId}/password`, {
      newPassword: WEAK_PW,
      confirmPassword: WEAK_PW,
      forceLogout: false,
      reason: "Testing weak password",
    });
    expect(r.status).toBe(400);
  });

  it("12. confirm mismatch rejected", async () => {
    const studentId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: "DifferentP@ss1",
      forceLogout: false,
      reason: "Testing mismatch",
    });
    expect(r.status).toBe(400);
  });

  it("13. reason required", async () => {
    const studentId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "",
    });
    expect(r.status).toBe(400);
  });

  it("14. STUDENT denied", async () => {
    const targetId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${targetId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing student denial",
    }, studentCookie);
    expect(r.status).toBe(403);
  });

  it("15. OPERATION denied", async () => {
    const targetId = await makeUser("STUDENT");
    const r = await patch(`/admin/users/${targetId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: false,
      reason: "Testing teacher denial",
    }, teacherCookie);
    expect(r.status).toBe(403);
  });

  it("16. unauthenticated denied", async () => {
    const r = await http("PATCH", `/api/admin/users/${randomUUID()}/password`, {
      body: {
        newPassword: NEW_PW,
        confirmPassword: NEW_PW,
        forceLogout: false,
        reason: "Testing unauth",
      },
    });
    expect(r.status).toBe(401);
  });

  it("17. AuditLog written", async () => {
    const studentId = await makeUser("STUDENT");
    const beforeCount = await prisma.auditLog.count({
      where: { action: "ADMIN_USER_PASSWORD_CHANGED" },
    });
    await patch(`/admin/users/${studentId}/password`, {
      newPassword: NEW_PW,
      confirmPassword: NEW_PW,
      forceLogout: true,
      reason: "Testing audit log",
    });
    const afterCount = await prisma.auditLog.count({
      where: { action: "ADMIN_USER_PASSWORD_CHANGED" },
    });
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});
