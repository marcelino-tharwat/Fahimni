import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type {
  AuditLog,
  PaymentTransaction,
  Enrollment,
  Chapter,
  Stage,
} from "../../generated/prisma/client.js";

let server: Server;
let base: string;
const PW = "AdminUsers@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  enrollmentIds: [] as string[],
  paymentIds: [] as string[],
  auditLogIds: [] as string[],
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

async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", {
    body: { email, password: PW },
  });
  const sc = r.json as Record<string, unknown> | null;
  if (r.status !== 200 || !sc || !(sc as Record<string, unknown>).data) {
    throw new Error(`login failed for ${email}: ${r.status}`);
  }
  // auth returns { data: { accessToken, user } } — we need the cookie from set-cookie
  // Use the http helper with setCookie extraction
  const rawRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  const setCookie = rawRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie
    .split(";")[0]
    ?.trim();
  if (!cookie || !cookie.startsWith("access_token=")) {
    throw new Error(`login failed for ${email}: no access_token cookie`);
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
      email: `au-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName:
        overrides.fullName ??
        `AU ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `019${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: overrides.status ?? "ACTIVE",
      teacherApprovalState: overrides.teacherApprovalState ?? "NONE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makeStageChapter(
  teacherId: string,
): Promise<{ stageId: string; chapterId: string }> {
  const stageId = randomUUID();
  await prisma.stage.create({
    data: {
      id: stageId,
      name: `au-st-${randomUUID().slice(0, 6)}`,
      sortOrder: 1,
      teacherId,
    },
  });
  owned.stageIds.push(stageId);
  const chapterId = randomUUID();
  await prisma.chapter.create({
    data: {
      id: chapterId,
      name: `au-ch-${randomUUID().slice(0, 6)}`,
      sortOrder: 1,
      stageId,
      price: 100,
    },
  });
  owned.chapterIds.push(chapterId);
  return { stageId, chapterId };
}

async function enroll(
  studentId: string,
  chapterId: string,
  status: "ACTIVE" | "PAYMENT_PENDING",
) {
  const e = await prisma.enrollment.create({
    data: {
      studentId,
      chapterId,
      price: 0,
      paymentMethod: "FREE",
      status,
    },
  });
  owned.enrollmentIds.push(e.id);
}

async function createPayment(
  studentId: string,
  chapterId: string,
  status: "SUCCESS" | "PENDING" | "FAILED",
  amount = 100,
) {
  const p = await prisma.paymentTransaction.create({
    data: {
      studentId,
      chapterId,
      amount,
      status,
      paymobOrderId: `au-order-${randomUUID()}`,
      paymobTransactionId: `au-txn-${randomUUID()}`,
      rawCallback: { secret: "AU_CALLBACK_SECRET" },
    },
  });
  owned.paymentIds.push(p.id);
}

async function createTeacherProfile(userId: string) {
  await prisma.teacherProfile.create({
    data: { userId, subject: "Math" },
  });
}

async function createStudentProfile(userId: string, stageId: string) {
  await prisma.studentProfile.create({
    data: { userId, stageId },
  });
}

async function createAuditLog(
  userId: string,
  action: string,
): Promise<string> {
  const log = await prisma.auditLog.create({
    data: {
      action,
      resourceType: "User",
      resourceId: userId,
      userId,
      details: {},
    },
  });
  owned.auditLogIds.push(log.id);
  return log.id;
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;
let teacherA: string;
let studentActive: string;
let studentInactive: string;
let studentBanned: string;
let chapterA: string;
const searchToken = `AUSEARCH${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const adminId = await makeUser("ADMIN");
  const teacherAuthId = await makeUser("OPERATION");
  const studentAuthId = await makeUser("STUDENT");
  adminCookie = await login(
    (await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email,
  );
  teacherCookie = await login(
    (await prisma.user.findUniqueOrThrow({ where: { id: teacherAuthId } }))
      .email,
  );
  studentCookie = await login(
    (await prisma.user.findUniqueOrThrow({ where: { id: studentAuthId } }))
      .email,
  );

  teacherA = await makeUser("OPERATION", {
    fullName: `${searchToken} Teacher A`,
  });
  const { stageId, chapterId } = await makeStageChapter(teacherA);
  chapterA = chapterId;
  await createTeacherProfile(teacherA);

  studentActive = await makeUser("STUDENT", {
    fullName: `${searchToken} Active Student`,
  });
  await createStudentProfile(studentActive, stageId);
  await enroll(studentActive, chapterA, "ACTIVE");

  studentInactive = await makeUser("STUDENT", {
    fullName: `${searchToken} Inactive Student`,
    status: "INACTIVE",
  });

  studentBanned = await makeUser("STUDENT", {
    fullName: `${searchToken} Banned Student`,
    status: "BANNED",
  });

  await createPayment(studentActive, chapterA, "SUCCESS");
  await createAuditLog(adminId, "USER_LISTED");
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { id: { in: owned.auditLogIds } },
  });
  await prisma.paymentTransaction.deleteMany({
    where: { id: { in: owned.paymentIds } },
  });
  await prisma.enrollment.deleteMany({
    where: { id: { in: owned.enrollmentIds } },
  });
  await prisma.teacherSubscription.deleteMany({
    where: { teacherId: { in: owned.userIds } },
  });
  await prisma.teacherProfile.deleteMany({
    where: { userId: { in: owned.userIds } },
  });
  await prisma.studentProfile.deleteMany({
    where: { userId: { in: owned.userIds } },
  });
  await prisma.chapter.deleteMany({
    where: { id: { in: owned.chapterIds } },
  });
  await prisma.stage.deleteMany({
    where: { id: { in: owned.stageIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: owned.userIds } },
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const g = (p: string, cookie = adminCookie) =>
  http("GET", p, { cookie });
const dataOf = (r: HttpResult) =>
  r.json?.data as Record<string, unknown>;

describe("GET /api/admin/users — authorization", () => {
  it("1. ADMIN can list users (200)", async () => {
    const r = await g("/api/admin/users");
    expect(r.status).toBe(200);
  });
  it("2. unauthenticated denied (401)", async () => {
    const r = await http("GET", "/api/admin/users");
    expect(r.status).toBe(401);
  });
  it("3. OPERATION denied (403)", async () => {
    const r = await g("/api/admin/users", teacherCookie);
    expect(r.status).toBe(403);
  });
  it("4. STUDENT denied (403)", async () => {
    const r = await g("/api/admin/users", studentCookie);
    expect(r.status).toBe(403);
  });
});

describe("GET /api/admin/users — list", () => {
  it("5. returns paginated data with correct shape", async () => {
    const r = await g("/api/admin/users?limit=100");
    expect(r.status).toBe(200);
    const body = dataOf(r);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(6);
    const meta = body.meta as Record<string, unknown>;
    expect(meta).toHaveProperty("page");
    expect(meta).toHaveProperty("limit");
    expect(meta).toHaveProperty("total");
    expect(meta).toHaveProperty("totalPages");
  });

  it("6. search by name works", async () => {
    const r = await g(
      `/api/admin/users?q=${encodeURIComponent(searchToken)}&limit=100`,
    );
    const items = dataOf(r).data as { fullName: string }[];
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((u) => u.fullName.includes(searchToken))).toBe(true);
  });

  it("7. search by email works", async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: studentActive },
    });
    const r = await g(
      `/api/admin/users?q=${encodeURIComponent(target.email!)}`,
    );
    const items = dataOf(r).data as { id: string }[];
    expect(items.length).toBe(1);
    expect(items[0]!.id).toBe(studentActive);
  });

  it("8. search by mobile works", async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: studentActive },
    });
    const r = await g(
      `/api/admin/users?q=${encodeURIComponent(target.mobile)}`,
    );
    const items = dataOf(r).data as { id: string }[];
    expect(items.length).toBe(1);
    expect(items[0]!.id).toBe(studentActive);
  });

  it("9. filter by role = STUDENT works", async () => {
    const r = await g("/api/admin/users?role=STUDENT&limit=100");
    const items = dataOf(r).data as { role: string }[];
    expect(items.every((u) => u.role === "STUDENT")).toBe(true);
  });

  it("10. filter by role = ADMIN works", async () => {
    const r = await g("/api/admin/users?role=ADMIN&limit=100");
    const items = dataOf(r).data as { role: string }[];
    expect(items.every((u) => u.role === "ADMIN")).toBe(true);
  });

  it("11. filter by status = INACTIVE works", async () => {
    const r = await g("/api/admin/users?status=INACTIVE&limit=100");
    const items = dataOf(r).data as { id: string; status: string }[];
    expect(items.every((u) => u.status === "INACTIVE")).toBe(true);
    expect(items.some((u) => u.id === studentInactive)).toBe(true);
  });

  it("12. filter by status = BANNED works", async () => {
    const r = await g("/api/admin/users?status=BANNED&limit=100");
    const items = dataOf(r).data as { id: string; status: string }[];
    expect(items.every((u) => u.status === "BANNED")).toBe(true);
    expect(items.some((u) => u.id === studentBanned)).toBe(true);
  });

  it("13. combined role + status filter works", async () => {
    const r = await g(
      "/api/admin/users?role=STUDENT&status=ACTIVE&limit=100",
    );
    const items = dataOf(r).data as { role: string; status: string }[];
    expect(items.every((u) => u.role === "STUDENT" && u.status === "ACTIVE")).toBe(
      true,
    );
  });
});

describe("GET /api/admin/users/:userId — detail", () => {
  it("14. ADMIN can get user detail (200)", async () => {
    const r = await g(`/api/admin/users/${studentActive}`);
    expect(r.status).toBe(200);
    const d = dataOf(r) as Record<string, unknown>;
    expect(d).toHaveProperty("user");
    expect(d).toHaveProperty("counts");
    expect((d.user as Record<string, unknown>).id).toBe(studentActive);
  });

  it("15. detail returns profiles and counts", async () => {
    const r = await g(`/api/admin/users/${studentActive}`);
    const d = dataOf(r) as Record<string, unknown>;
    const user = d.user as Record<string, unknown>;
    const counts = d.counts as Record<string, number>;
    expect(user.profiles).toEqual({ student: true, teacher: false });
    expect(counts.enrollmentsCount).toBeGreaterThanOrEqual(1);
    expect(counts.quizAttemptsCount).toBeGreaterThanOrEqual(0);
  });

  it("16. teacher detail returns teacher profile and teacher counts", async () => {
    const r = await g(`/api/admin/users/${teacherA}`);
    const d = dataOf(r) as Record<string, unknown>;
    const user = d.user as Record<string, unknown>;
    const counts = d.counts as Record<string, number>;
    expect(user.profiles.teacher).toBe(true);
    expect(counts.teacherStagesCount).toBeGreaterThanOrEqual(1);
    expect(counts.teacherSubscriptionsCount).toBeGreaterThanOrEqual(0);
  });

  it("17. invalid / non-existent id → 404", async () => {
    expect(
      (await g(`/api/admin/users/${randomUUID()}`)).status,
    ).toBe(404);
    expect(
      (await g(`/api/admin/users/not-a-uuid`)).status,
    ).toBe(404);
  });

  it("18. detail returns recent audit logs", async () => {
    const r = await g(`/api/admin/users/${studentActive}`);
    const d = dataOf(r) as Record<string, unknown>;
    expect(d).toHaveProperty("recentAuditLogs");
  });
});

describe("Admin Users — no secrets exposed", () => {
  it("19. no sensitive fields across ANY users endpoint", async () => {
    const paths = [
      `/api/admin/users?limit=100`,
      `/api/admin/users/${studentActive}`,
      `/api/admin/users/${teacherA}`,
    ];
    for (const p of paths) {
      const raw = JSON.stringify((await g(p)).json);
      expect(raw).not.toMatch(
        /password|passwordHash|tokenVersion|refreshToken|resetToken|providerSecret|rawCallback|paymobOrderId|paymobTransactionId|AU_CALLBACK_SECRET/i,
      );
    }
  });
});
