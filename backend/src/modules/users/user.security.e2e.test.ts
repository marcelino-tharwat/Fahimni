import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import type { Role } from "../../generated/prisma/client.js";

/**
 * SECURITY E2E — /api/users and the /api/admin convention router.
 *
 * Verifies the fix for the critical hole where GET/POST /api/users were
 * unauthenticated (anyone could mint an ADMIN). Covers the full authorization
 * matrix and confirms sensitive fields never leak.
 */

let server: Server;
let base: string;
const PW = "UserSec@12345";
let pwHash: string;

const SUITE = `usersec-${Date.now().toString(36)}`;
const owned = { userIds: [] as string[] };

interface HttpResult {
  status: number;
  json: { success?: boolean; message?: string; data?: unknown } | null;
  setCookie: string[];
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
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}

function randomMobile(): string {
  return `01${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`;
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

async function seedUser(role: Role): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${SUITE}-${role.toLowerCase()}-${randomUUID().slice(0, 6)}@e2e.test`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName: `${SUITE} ${role}`,
      mobile: randomMobile(),
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let admin: { id: string; email: string };
let teacher: { id: string; email: string };
let student: { id: string; email: string };
let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  admin = await seedUser("ADMIN");
  teacher = await seedUser("OPERATION");
  student = await seedUser("STUDENT");

  adminCookie = await login(admin.email);
  teacherCookie = await login(teacher.email);
  studentCookie = await login(student.email);
});

afterAll(async () => {
  // Remove any users created through the API during the suite.
  const created = await prisma.user.findMany({
    where: { email: { startsWith: SUITE } },
    select: { id: true },
  });
  const allIds = Array.from(new Set([...owned.userIds, ...created.map((u) => u.id)]));
  // Audit logs reference users (FK) — delete them first.
  await prisma.auditLog.deleteMany({ where: { userId: { in: allIds } } });
  await prisma.user.deleteMany({ where: { id: { in: allIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("GET /api/users — authorization", () => {
  it("1. rejects unauthenticated request with 401", async () => {
    const r = await http("GET", "/api/users");
    expect(r.status).toBe(401);
  });

  it("2. rejects STUDENT with 403", async () => {
    const r = await http("GET", "/api/users", { cookie: studentCookie });
    expect(r.status).toBe(403);
  });

  it("3. rejects OPERATION (teacher) with 403", async () => {
    const r = await http("GET", "/api/users", { cookie: teacherCookie });
    expect(r.status).toBe(403);
  });

  it("4. allows ADMIN and returns a paginated list", async () => {
    const r = await http("GET", "/api/users?page=1&limit=5", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const data = r.json?.data as {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      data: unknown[];
    };
    expect(data.page).toBe(1);
    expect(data.limit).toBe(5);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(3);
  });

  it("9a. never exposes password / tokenVersion in the list", async () => {
    const r = await http("GET", "/api/users?limit=50", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = (r.json?.data as { data: Record<string, unknown>[] }).data;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty("password");
      expect(row).not.toHaveProperty("tokenVersion");
    }
  });
});

describe("POST /api/users — cannot create ADMIN except by an admin", () => {
  const attempt = (cookie?: string) => {
    const email = `${SUITE}-attempt-${randomUUID().slice(0, 6)}@e2e.test`;
    return {
      email,
      run: () =>
        http("POST", "/api/users", {
          cookie,
          body: {
            fullName: "Should Not Exist",
            email,
            password: "Password@123",
            mobile: randomMobile(),
            role: "ADMIN",
          },
        }),
    };
  };

  it("5. unauthenticated request cannot create an ADMIN (401, no user created)", async () => {
    const a = attempt();
    const r = await a.run();
    expect(r.status).toBe(401);
    const exists = await prisma.user.findUnique({ where: { email: a.email } });
    expect(exists).toBeNull();
  });

  it("6. STUDENT cannot create an ADMIN (403, no user created)", async () => {
    const a = attempt(studentCookie);
    const r = await a.run();
    expect(r.status).toBe(403);
    const exists = await prisma.user.findUnique({ where: { email: a.email } });
    expect(exists).toBeNull();
  });

  it("7. OPERATION cannot create an ADMIN (403, no user created)", async () => {
    const a = attempt(teacherCookie);
    const r = await a.run();
    expect(r.status).toBe(403);
    const exists = await prisma.user.findUnique({ where: { email: a.email } });
    expect(exists).toBeNull();
  });

  it("8. ADMIN can create a user, and the response omits sensitive fields", async () => {
    const email = `${SUITE}-created-${randomUUID().slice(0, 6)}@e2e.test`;
    const r = await http("POST", "/api/users", {
      cookie: adminCookie,
      body: {
        fullName: "Created By Admin",
        email,
        password: "Password@123",
        mobile: randomMobile(),
        role: "STUDENT",
      },
    });
    expect(r.status).toBe(201);
    const user = r.json?.data as Record<string, unknown>;
    expect(user.email).toBe(email);
    expect(user.role).toBe("STUDENT");
    // 9b. sensitive fields must never be returned.
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("tokenVersion");

    const inDb = await prisma.user.findUnique({ where: { email } });
    expect(inDb).not.toBeNull();
  });
});

describe("/api/admin convention router", () => {
  it("rejects unauthenticated access to /api/admin/me (401)", async () => {
    const r = await http("GET", "/api/admin/me");
    expect(r.status).toBe(401);
  });

  it("rejects STUDENT and OPERATION from /api/admin/me (403)", async () => {
    expect((await http("GET", "/api/admin/me", { cookie: studentCookie })).status).toBe(403);
    expect((await http("GET", "/api/admin/me", { cookie: teacherCookie })).status).toBe(403);
  });

  it("allows ADMIN on /api/admin/me and reports the DB-sourced role", async () => {
    const r = await http("GET", "/api/admin/me", { cookie: adminCookie });
    expect(r.status).toBe(200);
    const data = r.json?.data as { id: string; role: string };
    expect(data.id).toBe(admin.id);
    expect(data.role).toBe("ADMIN");
  });

  it("protects /api/admin/users with the ADMIN convention", async () => {
    expect((await http("GET", "/api/admin/users")).status).toBe(401);
    expect((await http("GET", "/api/admin/users", { cookie: studentCookie })).status).toBe(403);
    expect((await http("GET", "/api/admin/users", { cookie: adminCookie })).status).toBe(200);
  });
});

describe("regression — public auth flows still work", () => {
  it("10. existing login still issues an access_token cookie", async () => {
    const r = await http("POST", "/api/v1/auth/login", {
      body: { email: admin.email, password: PW },
    });
    expect(r.status).toBe(200);
    expect(
      r.setCookie.some((c) => c.startsWith("access_token=")),
    ).toBe(true);
  });

  it("public registration cannot create an ADMIN (role is clamped)", async () => {
    const email = `${SUITE}-reg-${randomUUID().slice(0, 6)}@e2e.test`;
    const r = await http("POST", "/api/v1/auth/register", {
      body: {
        fullName: "Public Register",
        email,
        password: "Password@123",
        mobile: randomMobile(),
        role: "ADMIN",
      },
    });
    // Either the schema rejects the ADMIN role (400) or it is clamped to a
    // non-admin role — never persisted as ADMIN.
    if (r.status < 400) {
      const created = await prisma.user.findUnique({
        where: { email },
        select: { role: true },
      });
      expect(created?.role).not.toBe("ADMIN");
    } else {
      const created = await prisma.user.findUnique({ where: { email } });
      expect(created).toBeNull();
    }
  });
});
