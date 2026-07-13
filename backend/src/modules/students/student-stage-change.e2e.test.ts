import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Server } from "node:http";

let server: Server;
let base: string;
const PW = "StageChg@123";
const RUN = randomUUID().slice(0, 8);
let pwHash: string;

const owned = { userIds: [] as string[], stageIds: [] as string[] };

interface Res {
  status: number;
  json: Record<string, unknown> | null;
  setCookie: string[];
}
async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown } = {},
): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: Res["json"] = null;
  try {
    json = (await res.json()) as Res["json"];
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
const dataOf = (r: Res) => (r.json?.data ?? {}) as Record<string, unknown>;

function randomMobile(): string {
  return `017${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

async function makeUser(
  role: "ADMIN" | "STUDENT",
  label: string,
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `stage-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName: `StageChg ${label} ${RUN}`,
      mobile: randomMobile(),
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function makeStage(
  name: string,
  sortOrder: number,
  isActive = true,
): Promise<string> {
  const id = randomUUID();
  await prisma.stage.create({
    data: {
      id,
      name: `Stage ${name} ${RUN}`,
      sortOrder,
      isActive,
      teacherId: null,
    },
  });
  owned.stageIds.push(id);
  return id;
}

/**
 * Mock Date globally for the callback. Re-login is handled by the caller
 * INSIDE the callback so the JWT is minted at the mocked time.
 */
function withMockedDate(dateStr: string, fn: () => Promise<void>): Promise<void> {
  const RealDate = Date;
  const mockTime = new RealDate(dateStr).getTime();
  // @ts-expect-error — override Date for testing
  globalThis.Date = class extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(mockTime);
      } else {
        super(...(args as ConstructorParameters<typeof RealDate>));
      }
    }
    static now() {
      return mockTime;
    }
  } as typeof Date;
  return fn().finally(() => {
    globalThis.Date = RealDate;
  });
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 10);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${(addr as { port: number }).port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (owned.userIds.length) {
    await prisma.studentStageChangeLog.deleteMany({
      where: { studentId: { in: owned.userIds } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: owned.userIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { userId: { in: owned.userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  }
  if (owned.stageIds.length) {
    await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  }
  server?.close();
});

describe("Student Stage Change", () => {
  let stage1: string;
  let stage2: string;
  let stage3: string;
  let student: { id: string; email: string };
  let admin: { id: string; email: string };

  beforeAll(async () => {
    stage1 = await makeStage("First", 1);
    stage2 = await makeStage("Second", 2);
    stage3 = await makeStage("Third", 3);

    student = await makeUser("STUDENT", "TestStudent");
    await prisma.studentProfile.create({
      data: { userId: student.id, stageId: stage1 },
    });

    admin = await makeUser("ADMIN", "TestAdmin");
  });

  // ── 1. Policy endpoint ─────────────────────────────────────────────
  it("1. student can fetch stage change policy", async () => {
    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("GET", "/api/students/me/stage-change-policy", {
        cookie,
      });
      expect(r.status).toBe(200);
      const data = dataOf(r);
      expect(data.canChangeStage).toBe(true);
      expect(data.alreadyChangedThisYear).toBe(false);
      expect(data.currentStage).toBeDefined();
      expect((data.currentStage as Record<string, unknown>).id).toBe(stage1);
      expect(Array.isArray(data.availableStages)).toBe(true);
      const ids = (data.availableStages as Array<Record<string, unknown>>).map((s) => s.id);
      expect(ids).toContain(stage2);
      expect(ids).toContain(stage3);
      expect(ids).not.toContain(stage1);
    });
  });

  // ── 2. Non-student cannot access policy ─────────────────────────────
  it("2. non-student cannot access stage change policy", async () => {
    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(admin.email);
      const r = await http("GET", "/api/students/me/stage-change-policy", {
        cookie,
      });
      expect(r.status).toBe(403);
    });
  });

  // ── 3. Student can change stage during July-August window ───────────
  it("3. student can change stage during window", async () => {
    await withMockedDate("2026-07-20T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage2 },
      });
      expect(r.status).toBe(200);

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: student.id },
      });
      expect(profile?.stageId).toBe(stage2);

      const log = await prisma.studentStageChangeLog.findFirst({
        where: { studentId: student.id, changeType: "SELF" },
      });
      expect(log).not.toBeNull();
      expect(log?.oldStageId).toBe(stage1);
      expect(log?.newStageId).toBe(stage2);
      expect(log?.academicYear).toBe("2026");
    });
  });

  // ── 4. Student cannot change stage outside window ───────────────────
  it("4. student cannot change stage outside window", async () => {
    await withMockedDate("2026-05-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage3 },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "STUDENT_STAGE_CHANGE_WINDOW_CLOSED",
      );
    });
  });

  // ── 5. Student cannot change stage twice in same academic year ──────
  it("5. student cannot change stage twice in same year", async () => {
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });
    await prisma.studentStageChangeLog.create({
      data: {
        studentId: student.id,
        oldStageId: stage1,
        newStageId: stage2,
        changedByUserId: student.id,
        changedByRole: "STUDENT",
        changeType: "SELF",
        academicYear: "2026",
      },
    });

    await withMockedDate("2026-07-25T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage2 },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "STUDENT_STAGE_ALREADY_CHANGED_THIS_YEAR",
      );
    });
  });

  // ── 6. Student can change again in next year ────────────────────────
  it("6. student can change again next year", async () => {
    await prisma.studentStageChangeLog.deleteMany({
      where: { studentId: student.id },
    });
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });

    await withMockedDate("2027-07-10T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage2 },
      });
      expect(r.status).toBe(200);

      const log = await prisma.studentStageChangeLog.findFirst({
        where: { studentId: student.id, changeType: "SELF", academicYear: "2027" },
      });
      expect(log).not.toBeNull();
    });

    await prisma.studentStageChangeLog.deleteMany({
      where: { studentId: student.id },
    });
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });
  });

  // ── 7. Student cannot step back ─────────────────────────────────────
  it("7. student cannot step back to lower stage", async () => {
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage2 },
    });

    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage1 },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "STUDENT_STAGE_STEP_BACK_NOT_ALLOWED",
      );
    });

    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });
  });

  // ── 8. Student cannot change to same stage ──────────────────────────
  it("8. student cannot change to same stage", async () => {
    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: stage1 },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "INVALID_STUDENT_STAGE",
      );
    });
  });

  // ── 9. Inactive target stage rejected ───────────────────────────────
  it("9. inactive target stage is rejected", async () => {
    const inactiveStage = await makeStage("Inactive", 5, false);

    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: inactiveStage },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "INVALID_STUDENT_STAGE",
      );
    });
  });

  // ── 10. Non-existent stage rejected ─────────────────────────────────
  it("10. non-existent stage is rejected", async () => {
    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("PATCH", "/api/students/me/stage", {
        cookie,
        body: { stageId: randomUUID() },
      });
      expect(r.status).toBe(400);
      expect((r.json as Record<string, unknown>)?.code).toBe(
        "INVALID_STUDENT_STAGE",
      );
    });
  });

  // ── 11. Admin stage change works outside window ─────────────────────
  it("11. admin can change student stage outside window", async () => {
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });

    await withMockedDate("2026-04-15T12:00:00Z", async () => {
      const cookie = await login(admin.email);
      const r = await http("PATCH", `/api/admin/users/${student.id}`, {
        cookie,
        body: { studentProfile: { stageId: stage2 } },
      });
      expect(r.status).toBe(200);

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: student.id },
      });
      expect(profile?.stageId).toBe(stage2);
    });
  });

  // ── 12. Admin change does not count as student self-change ──────────
  it("12. admin change does not count as student self-change", async () => {
    const log = await prisma.studentStageChangeLog.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    expect(log?.changeType).toBe("ADMIN_OVERRIDE");
    expect(log?.changedByRole).toBe("ADMIN");

    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("GET", "/api/students/me/stage-change-policy", {
        cookie,
      });
      expect(r.status).toBe(200);
      const data = dataOf(r);
      expect(data.alreadyChangedThisYear).toBe(false);
    });
  });

  // ── 13. Admin can move student backward ─────────────────────────────
  it("13. admin can move student backward", async () => {
    await withMockedDate("2026-04-20T12:00:00Z", async () => {
      const cookie = await login(admin.email);
      const r = await http("PATCH", `/api/admin/users/${student.id}`, {
        cookie,
        body: { studentProfile: { stageId: stage1 } },
      });
      expect(r.status).toBe(200);
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: student.id },
      });
      expect(profile?.stageId).toBe(stage1);
    });
  });

  // ── 14. Available stages only include forward stages ────────────────
  it("14. policy only shows forward stages as available", async () => {
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage2 },
    });

    await withMockedDate("2026-07-15T12:00:00Z", async () => {
      const cookie = await login(student.email);
      const r = await http("GET", "/api/students/me/stage-change-policy", {
        cookie,
      });
      expect(r.status).toBe(200);
      const data = dataOf(r);
      const available = data.availableStages as Array<Record<string, unknown>>;
      const availIds = available.map((s) => s.id);
      expect(availIds).toContain(stage3);
      expect(availIds).not.toContain(stage1);
      expect(availIds).not.toContain(stage2);
      available.forEach((s) => {
        expect((s as { sortOrder: number }).sortOrder).toBeGreaterThan(2);
      });
    });

    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { stageId: stage1 },
    });
  });
});
