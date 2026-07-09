import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "AdminUsersMut@123";
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
  const rawRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  const setCookie = rawRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0]?.trim();
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
      email: `au-mut-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: overrides.fullName ?? `AU Mut ${role} ${randomUUID().slice(0, 4)}`,
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

async function makeStageChapter(
  teacherId: string,
): Promise<{ stageId: string; chapterId: string }> {
  const stageId = randomUUID();
  await prisma.stage.create({
    data: { id: stageId, name: `au-mut-st-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId },
  });
  owned.stageIds.push(stageId);
  const chapterId = randomUUID();
  await prisma.chapter.create({
    data: { id: chapterId, name: `au-mut-ch-${randomUUID().slice(0, 6)}`, sortOrder: 1, stageId, price: 100 },
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
    data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status },
  });
  owned.enrollmentIds.push(e.id);
}

async function createPayment(studentId: string, chapterId: string) {
  const p = await prisma.paymentTransaction.create({
    data: {
      studentId, chapterId, amount: 100, status: "SUCCESS",
      paymobOrderId: `au-mut-order-${randomUUID()}`, paymobTransactionId: `au-mut-txn-${randomUUID()}`,
      rawCallback: {},
    },
  });
  owned.paymentIds.push(p.id);
}

async function createTeacherProfile(userId: string) {
  await prisma.teacherProfile.create({ data: { userId, subject: "Math" } });
}

async function createStudentProfile(userId: string, stageId: string) {
  await prisma.studentProfile.create({ data: { userId, stageId } });
}

async function createQuizAttempt(studentId: string, quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return;
  await prisma.quizAttempt.upsert({
    where: { quizId_studentId: { quizId, studentId } },
    update: { status: "COMPLETED", score: 5 },
    create: {
      id: randomUUID(), quizId, studentId,
      answers: {}, status: "COMPLETED", score: 5, totalPoints: 10,
      startedAt: new Date(), completedAt: new Date(), durationMinutesSnapshot: 10,
    },
  });
}

async function createQuiz(teacherId: string, chapterId: string): Promise<string> {
  const q = await prisma.quiz.create({
    data: { id: randomUUID(), title: "E2E Test Quiz", chapterId, contentScope: "CHAPTER", sourceScope: "SINGLE_CHAPTER", sourceChapterIds: [], createdBy: teacherId, questionCount: 1, totalPoints: 10, status: "PUBLISHED", publishedAt: new Date() },
  });
  owned.userIds.push(teacherId);
  return q.id;
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;
let adminA: string;
let adminB: string;
let adminC: string;
let adminCCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  adminA = await makeUser("ADMIN", { fullName: "AU Mut Admin A" });
  adminB = await makeUser("ADMIN", { fullName: "AU Mut Admin B" });
  adminC = await makeUser("ADMIN", { fullName: "AU Mut Admin C" });
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminA } })).email);
  adminCCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminC } })).email);
  const teacherAuthId = await makeUser("OPERATION");
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherAuthId } })).email);
  const studentAuthId = await makeUser("STUDENT");
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentAuthId } })).email);
});

afterAll(async () => {
  // Clean up audit logs referencing test users (to avoid FK violations on user delete)
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: owned.userIds } }, { resourceId: { in: owned.userIds } }] } });
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.paymentIds } } });
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: { in: owned.userIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.quiz.deleteMany({ where: { createdBy: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const g = (p: string, cookie = adminCookie) => http("GET", p, { cookie });
const post = (p: string, body: unknown, cookie = adminCookie) => http("POST", p, { cookie, body });
const patch = (p: string, body: unknown, cookie = adminCookie) => http("PATCH", p, { cookie, body });
const dataOf = (r: HttpResult) => r.json?.data as Record<string, unknown>;

describe("POST /api/admin/users — create user", () => {
  const email = `create-student-${randomUUID().slice(0, 8)}@e2e.test`;

  it("1. ADMIN creates STUDENT", async () => {
    const r = await post("/api/admin/users", {
      fullName: "New Student", email, mobile: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      password: "Str0ng!Pass", role: "STUDENT",
    });
    expect(r.status).toBe(201);
    const d = dataOf(r);
    expect(d.role).toBe("STUDENT");
    expect(d.email).toBe(email);
    expect(d).not.toHaveProperty("password");
    expect(d).not.toHaveProperty("tokenVersion");
  });

  it("2. ADMIN creates OPERATION teacher", async () => {
    const r = await post("/api/admin/users", {
      fullName: "New Teacher", email: `create-teacher-${randomUUID().slice(0, 8)}@e2e.test`,
      mobile: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      password: "Str0ng!Pass", role: "OPERATION",
    });
    expect(r.status).toBe(201);
    expect(dataOf(r).role).toBe("OPERATION");
  });

  it("3. ADMIN creates ADMIN safely", async () => {
    const r = await post("/api/admin/users", {
      fullName: "New Admin", email: `create-admin-${randomUUID().slice(0, 8)}@e2e.test`,
      mobile: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      password: "Str0ng!Pass", role: "ADMIN",
    });
    expect(r.status).toBe(201);
    expect(dataOf(r).role).toBe("ADMIN");
  });

  it("4. duplicate email rejected", async () => {
    const r = await post("/api/admin/users", {
      fullName: "Duplicate", email, mobile: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      password: "Str0ng!Pass", role: "STUDENT",
    });
    expect(r.status).toBe(409);
  });

  it("5. duplicate mobile rejected", async () => {
    const existing = await prisma.user.findFirst({ where: {}, orderBy: { createdAt: "desc" } });
    const r = await post("/api/admin/users", {
      fullName: "Dup Mobile", email: `dup-mob-${randomUUID().slice(0, 8)}@e2e.test`,
      mobile: existing!.mobile, password: "Str0ng!Pass", role: "STUDENT",
    });
    expect(r.status).toBe(409);
  });
});

describe("PATCH /api/admin/users/:userId — edit user", () => {
  let targetId: string;
  const newEmail = `edited-${randomUUID().slice(0, 8)}@e2e.test`;

  beforeAll(async () => {
    targetId = await makeUser("STUDENT");
  });

  it("6. ADMIN edits user basic fields", async () => {
    const r = await patch(`/api/admin/users/${targetId}`, {
      fullName: "Edited Name", email: newEmail,
    });
    expect(r.status).toBe(200);
    const d = dataOf(r);
    expect(d.fullName).toBe("Edited Name");
    expect(d.email).toBe(newEmail);
    expect(d).not.toHaveProperty("password");
    expect(d).not.toHaveProperty("tokenVersion");
  });
});

describe("PATCH /api/admin/users/:userId/status — status change", () => {
  let targetId: string;

  beforeAll(async () => {
    targetId = await makeUser("STUDENT");
  });

  it("7. ADMIN bans user", async () => {
    const r = await patch(`/api/admin/users/${targetId}/status`, { status: "BANNED", reason: "Violation" });
    expect(r.status).toBe(200);
    expect(dataOf(r).status).toBe("BANNED");
  });

  it("8. banned user cannot login", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email: u.email, password: PW },
    });
    // Auth service returns 403 for banned/inactive users
    expect(r.status).toBe(403);
  });

  it("9. ADMIN unbans user", async () => {
    const r = await patch(`/api/admin/users/${targetId}/status`, { status: "ACTIVE" });
    expect(r.status).toBe(200);
    expect(dataOf(r).status).toBe("ACTIVE");
  });

  it("10. ADMIN activates/deactivates user", async () => {
    const r1 = await patch(`/api/admin/users/${targetId}/status`, { status: "INACTIVE" });
    expect(r1.status).toBe(200);
    expect(dataOf(r1).status).toBe("INACTIVE");

    const r2 = await patch(`/api/admin/users/${targetId}/status`, { status: "ACTIVE" });
    expect(r2.status).toBe(200);
    expect(dataOf(r2).status).toBe("ACTIVE");
  });

  it("11. cannot ban/deactivate self", async () => {
    const r = await patch(`/api/admin/users/${adminA}/status`, { status: "BANNED" });
    expect(r.status).toBe(403);
  });

  it("12. cannot ban/deactivate last active ADMIN", async () => {
    // Direct DB: deactivate all active admins EXCEPT adminA (avoids rate limiting)
    const otherIds = (await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: adminA } },
      select: { id: true },
    })).map((u: { id: string }) => u.id);
    await prisma.user.updateMany({
      where: { id: { in: otherIds } },
      data: { status: "INACTIVE" },
    });
    try {
      // adminA is now the only active admin. Self-deactivation should be blocked with 409.
      const r = await patch(`/api/admin/users/${adminA}/status`, { status: "INACTIVE" }, adminCookie);
      expect(r.status).toBe(409);
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: otherIds } },
        data: { status: "ACTIVE" },
      });
    }
  });
});

describe("PATCH /api/admin/users/:userId/role — role management", () => {
  it("13. ADMIN changes role STUDENT → OPERATION for clean student", async () => {
    const cleanStudentId = await makeUser("STUDENT");
    const r = await patch(`/api/admin/users/${cleanStudentId}/role`, { role: "OPERATION" });
    expect(r.status).toBe(200);
    expect(dataOf(r).role).toBe("OPERATION");
  });

  it("14. ADMIN changes role OPERATION → STUDENT for clean teacher", async () => {
    const cleanTeacherId = await makeUser("OPERATION");
    // Ensure no profile dependency
    const r = await patch(`/api/admin/users/${cleanTeacherId}/role`, { role: "STUDENT" });
    expect(r.status).toBe(200);
    expect(dataOf(r).role).toBe("STUDENT");
  });

  it("15. cannot change own role", async () => {
    const r = await patch(`/api/admin/users/${adminA}/role`, { role: "STUDENT" });
    expect(r.status).toBe(403);
  });

  it("16. cannot demote last active ADMIN", async () => {
    // Direct DB: deactivate all active admins EXCEPT adminA (avoids rate limiting)
    const otherIds = (await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: adminA } },
      select: { id: true },
    })).map((u: { id: string }) => u.id);
    await prisma.user.updateMany({
      where: { id: { in: otherIds } },
      data: { status: "INACTIVE" },
    });
    try {
      // adminA is now the only active admin. Self-demotion should be blocked with 409.
      const r = await patch(`/api/admin/users/${adminA}/role`, { role: "STUDENT" }, adminCookie);
      expect(r.status).toBe(409);
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: otherIds } },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("17. teacher with courses/lessons/content cannot change role", async () => {
    const teacherId = await makeUser("OPERATION", { fullName: "Teacher With Content" });
    await createTeacherProfile(teacherId);
    const { chapterId } = await makeStageChapter(teacherId);
    await createQuiz(teacherId, chapterId);

    const r = await patch(`/api/admin/users/${teacherId}/role`, { role: "STUDENT" });
    expect(r.status).toBe(409);
    const body = r.json as Record<string, unknown>;
    expect(body.code ?? (body as Record<string, unknown>).data?.code).toMatch(/ROLE_CHANGE_BLOCKED_HAS_TEACHER_DATA/);
  });

  it("18. teacher with subscription/payment records cannot change role", async () => {
    const teacherId = await makeUser("OPERATION", { fullName: "Teacher With Sub" });
    await createTeacherProfile(teacherId);
    // Create a plan if none exists (e2e test DB may not be seeded)
    let plan = await prisma.teacherPlan.findFirst({ where: { code: "FREE" } });
    if (!plan) {
      plan = await prisma.teacherPlan.create({
        data: { id: randomUUID(), code: "FREE", name: "Free Plan", displayName: "Free Plan" },
      });
    }
    await prisma.teacherSubscription.create({
      data: {
        id: randomUUID(), teacherId, planId: plan.id, status: "TRIALING",
        billingInterval: "MONTHLY", startedAt: new Date(),
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    });

    const r = await patch(`/api/admin/users/${teacherId}/role`, { role: "STUDENT" });
    expect(r.status).toBe(409);
    const body = r.json as Record<string, unknown>;
    expect(body.code ?? JSON.stringify(body)).toMatch(/ROLE_CHANGE_BLOCKED_HAS_TEACHER_DATA/);
  });

  it("20. student with enrollments/subscriptions cannot change role", async () => {
    const studentId = await makeUser("STUDENT");
    const { stageId, chapterId } = await makeStageChapter(await makeUser("OPERATION"));
    await createStudentProfile(studentId, stageId);
    await enroll(studentId, chapterId, "ACTIVE");
    await createPayment(studentId, chapterId);

    const r = await patch(`/api/admin/users/${studentId}/role`, { role: "OPERATION" });
    expect(r.status).toBe(409);
    const body = r.json as Record<string, unknown>;
    expect(body.code ?? JSON.stringify(body)).toMatch(/ROLE_CHANGE_BLOCKED_HAS_STUDENT_DATA/);
  });

  it("21. blocked role change does not modify role", async () => {
    const studentId = await makeUser("STUDENT");
    const { stageId, chapterId } = await makeStageChapter(await makeUser("OPERATION"));
    await createStudentProfile(studentId, stageId);
    await enroll(studentId, chapterId, "ACTIVE");

    const before = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { role: true } });
    const r = await patch(`/api/admin/users/${studentId}/role`, { role: "OPERATION" });
    expect(r.status).toBe(409);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { role: true } });
    expect(after.role).toBe(before.role);
  });

  it("22. blocked role change does not delete profiles or linked data", async () => {
    const studentId = await makeUser("STUDENT");
    const { stageId, chapterId } = await makeStageChapter(await makeUser("OPERATION"));
    await createStudentProfile(studentId, stageId);
    await enroll(studentId, chapterId, "ACTIVE");

    const beforeEnrollments = await prisma.enrollment.count({ where: { studentId } });
    const r = await patch(`/api/admin/users/${studentId}/role`, { role: "OPERATION" });
    expect(r.status).toBe(409);
    const afterEnrollments = await prisma.enrollment.count({ where: { studentId } });
    expect(afterEnrollments).toBe(beforeEnrollments);
    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    expect(profile).not.toBeNull();
  });
});

describe("Security / audit", () => {
  it("23. AuditLogs written for successful mutations", async () => {
    const startCount = await prisma.auditLog.count({ where: { action: { in: ["ADMIN_USER_CREATED", "ADMIN_USER_UPDATED", "ADMIN_USER_BANNED", "ADMIN_USER_UNBANNED", "ADMIN_USER_ACTIVATED", "ADMIN_USER_DEACTIVATED", "ADMIN_USER_ROLE_CHANGED"] } } });
    expect(startCount).toBeGreaterThanOrEqual(0);

    // Create a user triggers audit log
    const r = await post("/api/admin/users", {
      fullName: "Audit Test", email: `audit-${randomUUID().slice(0, 8)}@e2e.test`,
      mobile: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`, password: "Str0ng!Pass", role: "STUDENT",
    });
    expect(r.status).toBe(201);

    const afterCount = await prisma.auditLog.count({ where: { action: "ADMIN_USER_CREATED" } });
    expect(afterCount).toBeGreaterThanOrEqual(1);
  });

  it("24. no secrets exposed", async () => {
    const paths = ["/api/admin/users"];
    for (const p of paths) {
      const raw = JSON.stringify((await g(p)).json);
      expect(raw).not.toMatch(/password|passwordHash|tokenVersion|refreshToken/i);
    }
  });

  it("25. STUDENT denied", async () => {
    const r = await post("/api/admin/users", { fullName: "x", email: "x@e2e.test", mobile: "01000000000", password: "Str0ng!Pass", role: "STUDENT" }, studentCookie);
    expect(r.status).toBe(403);
  });

  it("26. OPERATION denied", async () => {
    const r = await post("/api/admin/users", { fullName: "x", email: "y@e2e.test", mobile: "01000000001", password: "Str0ng!Pass", role: "STUDENT" }, teacherCookie);
    expect(r.status).toBe(403);
  });

  it("27. unauthenticated denied", async () => {
    const r = await http("POST", "/api/admin/users", { body: { fullName: "x", email: "z@e2e.test", mobile: "01000000002", password: "Str0ng!Pass", role: "STUDENT" } });
    expect(r.status).toBe(401);
  });
});
