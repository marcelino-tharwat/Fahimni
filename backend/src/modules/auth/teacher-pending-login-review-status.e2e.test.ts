import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for teacher pending/rejected login review-status flow. Validates that
 * pending and rejected teachers can login in restricted mode, cannot access
 * teacher features, and can access the review-status endpoint. Approved and
 * banned user behavior is also verified for regression.
 */

let server: Server;
let base: string;
const PW = "Teacher@1234";
const RUN = randomUUID().slice(0, 8);
const email = (label: string) => `tplr-${label}-${RUN}@e2e.test`;
let pwHash: string;
const mobiles = new Set<string>();
function mob(): string {
  let m: string;
  do { m = `010${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`; } while (mobiles.has(m));
  mobiles.add(m);
  return m;
}
const owned = { userIds: [] as string[], requestIds: [] as string[], planIds: [] as string[], subIds: [] as string[] };

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
async function login(em: string): Promise<Res> {
  return http("POST", "/api/v1/auth/login", { body: { email: em, password: PW } });
}
function cookieOf(r: Res): string | undefined {
  return r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
}

async function makeUser(label: string, over: Record<string, unknown>): Promise<{ id: string; email: string }> {
  const u = await prisma.user.create({
    data: {
      id: randomUUID(), email: email(label), fullName: `TPLR ${label}`, mobile: mob(),
      password: pwHash, role: "OPERATION", ...over,
    } as never,
    select: { id: true, email: true },
  });
  owned.userIds.push(u.id);
  return u;
}
async function linkedRequest(userId: string, status: "PENDING" | "APPROVED" | "REJECTED", em: string): Promise<string> {
  const r = await prisma.teacherRegistrationRequest.create({
    data: { publicReference: `TPLR-${RUN}-${owned.requestIds.length + 1}`, fullName: "TPLR", email: em, mobile: mob(), status, proofDocuments: [], userId },
    select: { id: true },
  });
  owned.requestIds.push(r.id);
  return r.id;
}

let pending: { id: string; email: string };
let rejected: { id: string; email: string };
let approvedFree: { id: string; email: string };
let banned: { id: string; email: string };
let student: { id: string; email: string };

const GATED = "/api/dashboard/teacher/stats";
const REVIEW_STATUS = "/api/teachers/review-status";
const SUBSCRIPTION_ME = "/api/teacher/subscription/me";

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  pending = await makeUser("pending", { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
  await linkedRequest(pending.id, "PENDING", pending.email);

  rejected = await makeUser("rejected", { status: "INACTIVE", teacherApprovalState: "REJECTED" });
  await linkedRequest(rejected.id, "REJECTED", rejected.email);

  approvedFree = await makeUser("approved-free", { status: "ACTIVE", teacherApprovalState: "APPROVED" });

  banned = await makeUser("banned", { status: "BANNED", teacherApprovalState: "APPROVED" });

  // Create a student for regression testing.
  const stu = await prisma.user.create({
    data: {
      id: randomUUID(), email: email("student"), fullName: "TPLR Student",
      mobile: mob(), password: pwHash, role: "STUDENT", status: "ACTIVE",
    },
    select: { id: true, email: true },
  });
  owned.userIds.push(stu.id);
  student = stu;
});

afterAll(async () => {
  server?.close();
  // Cleanup owned records in reverse dependency order.
  if (owned.requestIds.length > 0) {
    await prisma.teacherRegistrationRequest.deleteMany({ where: { id: { in: owned.requestIds } } }).catch(() => {});
  }
  if (owned.subIds.length > 0) {
    await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subIds } } }).catch(() => {});
  }
  if (owned.planIds.length > 0) {
    await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } }).catch(() => {});
  }
  if (owned.userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } }).catch(() => {});
  }
});

describe("1. Pending teacher can login successfully", () => {
  it("returns 200 with TEACHER_PENDING_REVIEW accessState", async () => {
    const r = await login(pending.email);
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.accessState).toBe("TEACHER_PENDING_REVIEW");
    const user = data.user as Record<string, unknown>;
    expect(user.teacherApprovalState).toBe("PENDING_REVIEW");
    // Session cookies must be set.
    expect(cookieOf(r)).toBeDefined();
  });
});

describe("2. Pending teacher login response includes TEACHER_PENDING_REVIEW", () => {
  it("accessState is TEACHER_PENDING_REVIEW", async () => {
    const r = await login(pending.email);
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("TEACHER_PENDING_REVIEW");
  });
});

describe("3. Pending teacher cannot access teacher dashboard endpoint", () => {
  it("returns 403 TEACHER_PENDING_REVIEW", async () => {
    const cookie = cookieOf(await login(pending.email))!;
    const r = await http("GET", GATED, { cookie });
    expect(r.status).toBe(403);
    const body = r.json as Record<string, unknown>;
    expect(body.code).toBe("TEACHER_PENDING_REVIEW");
  });
});

describe("4. Pending teacher can access /api/teachers/review-status", () => {
  it("returns review status with safe data", async () => {
    const cookie = cookieOf(await login(pending.email))!;
    const r = await http("GET", REVIEW_STATUS, { cookie });
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.teacherApprovalState).toBe("PENDING_REVIEW");
    expect(data.canAccessTeacherFeatures).toBe(false);
    expect(data.message).toBeTruthy();
    // Request data should be present.
    const req = data.request as Record<string, unknown> | null;
    expect(req).not.toBeNull();
    expect(req!.publicReference).toBeTruthy();
    expect(req!.status).toBe("PENDING");
    // Must NOT expose secrets.
    expect(data).not.toHaveProperty("password");
    expect(data).not.toHaveProperty("adminNotes");
    expect(data).not.toHaveProperty("proofDocuments");
  });
});

describe("5. Rejected teacher can login to restricted status flow", () => {
  it("returns 200 with TEACHER_REJECTED accessState", async () => {
    const r = await login(rejected.email);
    expect(r.status).toBe(200);
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("TEACHER_REJECTED");
    const user = data.user as Record<string, unknown>;
    expect(user.teacherApprovalState).toBe("REJECTED");
    expect(cookieOf(r)).toBeDefined();
  });
});

describe("6. Rejected teacher cannot access teacher features", () => {
  it("returns 403 TEACHER_REJECTED on gated endpoint", async () => {
    const cookie = cookieOf(await login(rejected.email))!;
    const r = await http("GET", GATED, { cookie });
    expect(r.status).toBe(403);
    const body = r.json as Record<string, unknown>;
    expect(body.code).toBe("TEACHER_REJECTED");
  });
});

describe("7. Rejected teacher can access /api/teachers/review-status", () => {
  it("returns review status with rejected state", async () => {
    const cookie = cookieOf(await login(rejected.email))!;
    const r = await http("GET", REVIEW_STATUS, { cookie });
    expect(r.status).toBe(200);
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.teacherApprovalState).toBe("REJECTED");
    expect(data.canAccessTeacherFeatures).toBe(false);
    expect(data.message).toBeTruthy();
    // Must NOT expose admin notes.
    expect(data).not.toHaveProperty("adminNotes");
  });
});

describe("8. Approved teacher can login normally", () => {
  it("returns 200 with FREE_TEACHER accessState", async () => {
    const r = await login(approvedFree.email);
    expect(r.status).toBe(200);
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("FREE_TEACHER");
    const user = data.user as Record<string, unknown>;
    expect(user.teacherApprovalState).toBe("APPROVED");
    expect(user.status).toBe("ACTIVE");
  });
});

describe("9. Approved FREE teacher can access allowed teacher features", () => {
  it("subscription/me returns data (not blocked)", async () => {
    const cookie = cookieOf(await login(approvedFree.email))!;
    const r = await http("GET", SUBSCRIPTION_ME, { cookie });
    // Should not be 403 TEACHER_PENDING_REVIEW or TEACHER_REJECTED.
    expect(r.status).not.toBe(403);
  });
});

describe("10. Banned user cannot login", () => {
  it("returns 401 with invalid credentials", async () => {
    const r = await login(banned.email);
    // BANNED users see the same error as invalid credentials (no info leak).
    expect(r.status).toBe(401);
  });
});

describe("11. Normal inactive non-teacher remains blocked", () => {
  it("creating an inactive STUDENT and attempting login returns 403", async () => {
    const inactiveStudent = await prisma.user.create({
      data: {
        id: randomUUID(), email: email("inactive-stu"), fullName: "TPLR Inactive",
        mobile: mob(), password: pwHash, role: "STUDENT", status: "INACTIVE",
      },
      select: { id: true, email: true },
    });
    owned.userIds.push(inactiveStudent.id);
    const r = await login(inactiveStudent.email);
    expect(r.status).toBe(403);
    const body = r.json as Record<string, unknown>;
    expect(body.message).toContain("inactive");
  });
});

describe("12. Review-status endpoint does not expose secrets", () => {
  it("returns no password, adminNotes, proofDocuments, or storage paths", async () => {
    const cookie = cookieOf(await login(pending.email))!;
    const r = await http("GET", REVIEW_STATUS, { cookie });
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    const jsonStr = JSON.stringify(data);
    expect(jsonStr).not.toContain("password");
    expect(jsonStr).not.toContain("tokenVersion");
    expect(jsonStr).not.toContain("DEMO_FAKE");
    expect(jsonStr).not.toContain("adminNotes");
    expect(jsonStr).not.toContain("proofDocuments");
  });
});

describe("13. Admin approval changes next login from pending to approved flow", () => {
  it("after admin approves, pending teacher gets APPROVED login", async () => {
    // Create a fresh pending teacher for this test.
    const fresh = await makeUser("approval-transition", { status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW" });
    await linkedRequest(fresh.id, "PENDING", fresh.email);

    // Verify login is pending.
    let r = await login(fresh.email);
    let data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("TEACHER_PENDING_REVIEW");

    // Admin approves the teacher.
    await prisma.user.update({
      where: { id: fresh.id },
      data: { status: "ACTIVE", teacherApprovalState: "APPROVED" },
    });
    await prisma.teacherRegistrationRequest.updateMany({
      where: { userId: fresh.id, status: "PENDING" },
      data: { status: "APPROVED" },
    });

    // Now login should succeed with normal access.
    r = await login(fresh.email);
    expect(r.status).toBe(200);
    data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("FREE_TEACHER");
    const user = data.user as Record<string, unknown>;
    expect(user.teacherApprovalState).toBe("APPROVED");
    expect(user.status).toBe("ACTIVE");
  });
});

describe("14. Admin rejection changes next login to rejected flow", () => {
  it("after admin rejects, teacher login becomes restricted", async () => {
    // Create a fresh approved teacher for this test.
    const fresh = await makeUser("rejection-transition", { status: "ACTIVE", teacherApprovalState: "APPROVED" });

    // Verify login is approved.
    let r = await login(fresh.email);
    let data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("FREE_TEACHER");

    // Admin rejects the teacher.
    await prisma.user.update({
      where: { id: fresh.id },
      data: { status: "INACTIVE", teacherApprovalState: "REJECTED" },
    });

    // Now login should be restricted.
    r = await login(fresh.email);
    expect(r.status).toBe(200);
    data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.accessState).toBe("TEACHER_REJECTED");
  });
});

describe("15. Student login is unaffected", () => {
  it("student can login normally", async () => {
    const r = await login(student.email);
    expect(r.status).toBe(200);
    const data = (r.json as Record<string, unknown>).data as Record<string, unknown>;
    const user = data.user as Record<string, unknown>;
    expect(user.role).toBe("STUDENT");
    // accessState should not be present for students.
    expect(data.accessState).toBeUndefined();
  });
});

describe("16. Pending teacher can refresh tokens", () => {
  it("refresh endpoint works for restricted teacher", async () => {
    const loginRes = await login(pending.email);
    const refreshCookie = loginRes.setCookie
      .map((c) => c.split(";")[0]!)
      .find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();

    const r = await http("POST", "/api/v1/auth/refresh", { cookie: refreshCookie });
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.user).toBeDefined();
  });
});
