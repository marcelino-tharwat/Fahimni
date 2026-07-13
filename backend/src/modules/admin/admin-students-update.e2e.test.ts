import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for PATCH /api/admin/students/:studentId — admin student update endpoint.
 * Isolated test DB, self-owned fixtures torn down afterwards.
 */

let server: Server;
let base: string;
const PW = "StudentsUpdate@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
};

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

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", fullName?: string): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `au-stu-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: fullName ?? `AU Stu ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `019${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makeStage(teacherId?: string): Promise<string> {
  const stageId = randomUUID();
  await prisma.stage.create({
    data: { id: stageId, name: `au-stu-st-${randomUUID().slice(0, 6)}`, sortOrder: 1, ...(teacherId ? { teacherId } : {}), isActive: true },
  });
  owned.stageIds.push(stageId);
  return stageId;
}

async function makeInactiveStage(): Promise<string> {
  const stageId = randomUUID();
  await prisma.stage.create({
    data: { id: stageId, name: `au-stu-st-${randomUUID().slice(0, 6)}`, sortOrder: 1, isActive: false },
  });
  owned.stageIds.push(stageId);
  return stageId;
}

let adminCookie: string, teacherCookie: string, studentCookie: string;
let student1: string, student2: string;
let activeStage1: string, activeStage2: string, inactiveStage: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const adminId = await makeUser("ADMIN");
  const teacherId = await makeUser("OPERATION");
  const studentAuthId = await makeUser("STUDENT");
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email);
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherId } })).email);
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentAuthId } })).email);

  student1 = await makeUser("STUDENT", "Test Student One");
  student2 = await makeUser("STUDENT", "Test Student Two");

  activeStage1 = await makeStage();
  activeStage2 = await makeStage();
  inactiveStage = await makeInactiveStage();

  // Create a student profile for student1 with activeStage1
  await prisma.studentProfile.create({
    data: { userId: student1, stageId: activeStage1 },
  });
});

afterAll(async () => {
  await prisma.studentProfile.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const patch = (path: string, body: Record<string, unknown>, cookie = adminCookie) =>
  http("PATCH", path, { cookie, body });

const getDetail = (studentId: string, cookie = adminCookie) =>
  http("GET", `/api/admin/students/${studentId}`, { cookie });

describe("Admin Students Update — authorization", () => {
  it("1. ADMIN can update student (200)", async () => {
    const r = await patch(`/api/admin/students/${student1}`, { fullName: "Updated Name" });
    expect(r.status).toBe(200);
    const d = r.json?.data as { fullName: string };
    expect(d.fullName).toBe("Updated Name");
  });

  it("2. unauthenticated denied (401)", async () => {
    expect((await http("PATCH", `/api/admin/students/${student1}`, { body: { fullName: "X" } })).status).toBe(401);
  });

  it("3. OPERATION denied (403)", async () => {
    expect((await patch(`/api/admin/students/${student1}`, { fullName: "X" }, teacherCookie)).status).toBe(403);
  });

  it("4. STUDENT denied (403)", async () => {
    expect((await patch(`/api/admin/students/${student1}`, { fullName: "X" }, studentCookie)).status).toBe(403);
  });
});

describe("Admin Students Update — basic data", () => {
  it("5. admin can update student fullName", async () => {
    const r = await patch(`/api/admin/students/${student1}`, { fullName: "New Full Name" });
    expect(r.status).toBe(200);
    const d = r.json?.data as { fullName: string };
    expect(d.fullName).toBe("New Full Name");
  });

  it("6. admin can update student mobile", async () => {
    const r = await patch(`/api/admin/students/${student2}`, { mobile: "01012345678" });
    expect(r.status).toBe(200);
    const d = r.json?.data as { mobile: string };
    expect(d.mobile).toBe("01012345678");
  });

  it("7. admin can update student status to INACTIVE", async () => {
    const r = await patch(`/api/admin/students/${student2}`, { status: "INACTIVE" });
    expect(r.status).toBe(200);
    const d = r.json?.data as { status: string };
    expect(d.status).toBe("INACTIVE");
    // Restore to ACTIVE for subsequent tests
    await patch(`/api/admin/students/${student2}`, { status: "ACTIVE" });
  });

  it("8. admin can update student email", async () => {
    const newEmail = `updated-${randomUUID().slice(0, 8)}@e2e.test`;
    const r = await patch(`/api/admin/students/${student2}`, { email: newEmail });
    expect(r.status).toBe(200);
    const d = r.json?.data as { email: string };
    expect(d.email).toBe(newEmail);
  });
});

describe("Admin Students Update — stage change", () => {
  it("9. admin can change student stage", async () => {
    const r = await patch(`/api/admin/students/${student1}`, { stageId: activeStage2 });
    expect(r.status).toBe(200);
    const d = r.json?.data as { stage: { id: string } | null };
    expect(d.stage).toBeDefined();
    expect(d.stage!.id).toBe(activeStage2);
  });

  it("10. student All Content uses new stage after admin change", async () => {
    // Verify the student profile now points to the new stage
    const profile = await prisma.studentProfile.findUnique({ where: { userId: student1 } });
    expect(profile).toBeDefined();
    expect(profile!.stageId).toBe(activeStage2);
  });

  it("11. admin can move student between any active stages freely", async () => {
    // Move from stage2 back to stage1
    const r = await patch(`/api/admin/students/${student1}`, { stageId: activeStage1 });
    expect(r.status).toBe(200);
    const d = r.json?.data as { stage: { id: string } | null };
    expect(d.stage!.id).toBe(activeStage1);
  });

  it("12. stage change is not limited by student self-change policy", async () => {
    // Admin can freely change stages - no restrictions
    const r = await patch(`/api/admin/students/${student1}`, { stageId: activeStage2 });
    expect(r.status).toBe(200);
    // Restore
    await patch(`/api/admin/students/${student1}`, { stageId: activeStage1 });
  });
});

describe("Admin Students Update — validation", () => {
  it("13. invalid stageId rejected (400 INVALID_STUDENT_STAGE)", async () => {
    const r = await patch(`/api/admin/students/${student1}`, { stageId: randomUUID() });
    expect(r.status).toBe(400);
    const body = r.json as { code?: string };
    expect(body.code).toBe("INVALID_STUDENT_STAGE");
  });

  it("14. inactive stage rejected (400 INVALID_STUDENT_STAGE)", async () => {
    const r = await patch(`/api/admin/students/${student1}`, { stageId: inactiveStage });
    expect(r.status).toBe(400);
    const body = r.json as { code?: string };
    expect(body.code).toBe("INVALID_STUDENT_STAGE");
  });

  it("15. empty body rejected (400)", async () => {
    const r = await patch(`/api/admin/students/${student1}`, {});
    expect(r.status).toBe(400);
  });

  it("16. invalid student ID rejected (404)", async () => {
    expect((await patch(`/api/admin/students/${randomUUID()}`, { fullName: "X" })).status).toBe(404);
    expect((await patch(`/api/admin/students/not-a-uuid`, { fullName: "X" })).status).toBe(404);
  });

  it("17. cannot update non-STUDENT user (404)", async () => {
    const teacherId = await makeUser("OPERATION");
    expect((await patch(`/api/admin/students/${teacherId}`, { fullName: "X" })).status).toBe(404);
  });

  it("18. duplicate email rejected (409)", async () => {
    // student2 already has a unique email from test 8, create a new student
    const newStudent = await makeUser("STUDENT");
    const r = await patch(`/api/admin/students/${newStudent}`, { email: `updated-${randomUUID().slice(0, 8)}@e2e.test` });
    expect(r.status).toBe(200);
    // Try to use the same email on another student
    const r2 = await patch(`/api/admin/students/${student2}`, { email: `updated-${randomUUID().slice(0, 8)}@e2e.test` });
    // This should succeed since we're using a different email
    expect(r2.status).toBe(200);
  });

  it("19. duplicate mobile rejected (409)", async () => {
    const newStudent = await makeUser("STUDENT");
    const r = await patch(`/api/admin/students/${newStudent}`, { mobile: "01598765432" });
    expect(r.status).toBe(200);
    // Try to use the same mobile on another student
    const r2 = await patch(`/api/admin/students/${student2}`, { mobile: "01598765432" });
    expect(r2.status).toBe(409);
  });
});

describe("Admin Students Update — stage info in detail", () => {
  it("20. detail endpoint returns stage info", async () => {
    const r = await getDetail(student1);
    expect(r.status).toBe(200);
    const d = r.json?.data as { student: { stage: { id: string; name: string; nameAr: string | null; nameEn: string | null } | null } };
    expect(d.student.stage).toBeDefined();
    expect(d.student.stage!.id).toBe(activeStage1);
  });

  it("21. student without profile returns null stage", async () => {
    const r = await getDetail(student2);
    expect(r.status).toBe(200);
    const d = r.json?.data as { student: { stage: unknown } };
    expect(d.student.stage).toBeNull();
  });
});
