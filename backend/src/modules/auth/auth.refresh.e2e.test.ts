import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * AUTH refresh repair — real HTTP/PostgreSQL E2E for the session lifecycle:
 * cookie transport, hashed storage, rotation, replay rejection, revoke-on-logout.
 */

const PW = "E2ePass@123";
let pwHash: string;
let mobileSeq = 0;
let server: Server;
let base: string;
const owned = { userIds: [] as string[] };

interface Res {
  status: number;
  json: Record<string, unknown> | null;
  setCookie: string[];
}

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

/** Read a cookie value from Set-Cookie headers (empty string = cleared). */
function cookieVal(setCookie: string[], name: string): string | undefined {
  const entry = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!entry) return undefined;
  return entry.split(";")[0]!.slice(name.length + 1);
}
function cookieHeader(pairs: Record<string, string>): string {
  return Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join("; ");
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function createUser() {
  const id = randomUUID();
  mobileSeq += 1;
  const email = `auth-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: { id, email, fullName: "Auth User", mobile: `015${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`, password: pwHash, role: "STUDENT", status: "ACTIVE", emailVerified: true },
  });
  owned.userIds.push(id);
  return { id, email };
}
async function loginUser(email: string) {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  return r;
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("AUTH session/refresh lifecycle (E2E)", () => {
  it("login sets HttpOnly cookies, never returns the refresh token, and stores it hashed", async () => {
    const u = await createUser();
    const r = await loginUser(u.email);
    expect(r.status).toBe(200);

    // User in JSON, but NO token of any kind.
    expect((r.json!.data as { user: { id: string } }).user.id).toBe(u.id);
    expect(JSON.stringify(r.json)).not.toContain("refreshToken");
    expect(JSON.stringify(r.json)).not.toContain("accessToken");

    const access = cookieVal(r.setCookie, "access_token");
    const refresh = cookieVal(r.setCookie, "refresh_token");
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(r.setCookie.join(";")).toMatch(/HttpOnly/i);

    // DB stores the SHA-256 hash, never the raw token.
    const row = await prisma.refreshToken.findFirst({ where: { userId: u.id } });
    expect(row).not.toBeNull();
    expect(row!.token).not.toBe(refresh);
    expect(row!.token).toBe(sha256(refresh!));
  });

  it("rotates the refresh token, rejects the old one (replay), and keeps /me working", async () => {
    const u = await createUser();
    const login = await loginUser(u.email);
    const access0 = cookieVal(login.setCookie, "access_token")!;
    const refresh0 = cookieVal(login.setCookie, "refresh_token")!;
    const createdAt0 = (await prisma.refreshToken.findFirst({ where: { userId: u.id } }))!.createdAt;

    // /me works with the access cookie.
    const me = await http("GET", "/api/v1/auth/me", { cookie: cookieHeader({ access_token: access0 }) });
    expect(me.status).toBe(200);

    // Refresh using the refresh cookie → new cookies, no token in JSON.
    const refreshed = await http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh0 }) });
    expect(refreshed.status).toBe(200);
    expect(JSON.stringify(refreshed.json)).not.toContain("refreshToken");
    const refresh1 = cookieVal(refreshed.setCookie, "refresh_token")!;
    expect(refresh1).toBeTruthy();
    expect(refresh1).not.toBe(refresh0);

    // Rotation is IN PLACE: createdAt preserved (STORY-66 last-login proxy stable).
    const rowAfter = (await prisma.refreshToken.findFirst({ where: { userId: u.id } }))!;
    expect(rowAfter.createdAt.getTime()).toBe(createdAt0.getTime());
    expect(rowAfter.token).toBe(sha256(refresh1));

    // Replaying the OLD refresh token is rejected.
    const replay = await http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh0 }) });
    expect(replay.status).toBe(401);

    // The NEW refresh token still works.
    const refreshed2 = await http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh1 }) });
    expect(refreshed2.status).toBe(200);
  });

  it("rejects missing/invalid refresh tokens safely", async () => {
    expect((await http("POST", "/api/v1/auth/refresh")).status).toBe(401);
    expect((await http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: "not-a-jwt" }) })).status).toBe(401);
  });

  it("logout revokes the DB session, clears both cookies, and blocks reuse; idempotent", async () => {
    const u = await createUser();
    const login = await loginUser(u.email);
    const refresh0 = cookieVal(login.setCookie, "refresh_token")!;
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);

    const out = await http("POST", "/api/v1/auth/logout", { cookie: cookieHeader({ refresh_token: refresh0 }) });
    expect(out.status).toBe(200);
    // Both cookies cleared (value emptied).
    expect(cookieVal(out.setCookie, "access_token")).toBe("");
    expect(cookieVal(out.setCookie, "refresh_token")).toBe("");
    // DB session revoked.
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);

    // The old refresh token can no longer restore a session.
    const afterLogout = await http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh0 }) });
    expect(afterLogout.status).toBe(401);

    // Logout again (no session) is still safe.
    const out2 = await http("POST", "/api/v1/auth/logout", { cookie: cookieHeader({ refresh_token: refresh0 }) });
    expect(out2.status).toBe(200);
  });

  it("concurrent refresh with one token yields exactly one valid successor", async () => {
    const u = await createUser();
    const login = await loginUser(u.email);
    const refresh0 = cookieVal(login.setCookie, "refresh_token")!;

    const [a, b] = await Promise.all([
      http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh0 }) }),
      http("POST", "/api/v1/auth/refresh", { cookie: cookieHeader({ refresh_token: refresh0 }) }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
    // Exactly one active session row remains.
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);
  });

  it("second login invalidates the first session — old access and refresh tokens are rejected", async () => {
    const u = await createUser();

    // First login — device A
    const deviceA = await loginUser(u.email);
    const accessA = cookieVal(deviceA.setCookie, "access_token")!;
    const refreshA = cookieVal(deviceA.setCookie, "refresh_token")!;

    // Second login from another device — increments tokenVersion
    const deviceB = await loginUser(u.email);
    expect(deviceB.status).toBe(200);

    // Device A's access token should now be rejected (version mismatch)
    const oldMe = await http("GET", "/api/v1/auth/me", {
      cookie: cookieHeader({ access_token: accessA }),
    });
    expect(oldMe.status).toBe(401);

    // Device A's refresh token should also be rejected (version mismatch before rotation)
    const oldRefresh = await http("POST", "/api/v1/auth/refresh", {
      cookie: cookieHeader({ refresh_token: refreshA }),
    });
    expect(oldRefresh.status).toBe(401);

    // Device B's tokens should still work
    const meB = await http("GET", "/api/v1/auth/me", {
      cookie: cookieHeader({ access_token: cookieVal(deviceB.setCookie, "access_token")! }),
    });
    expect(meB.status).toBe(200);

    // Exactly one refresh token row remains (device B's)
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);
  });
});
