import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the Admin Audit Logs viewer. Isolated fixtures (unique run token).
 * Verifies ADMIN-only access, filters, detail, and read-path metadata
 * sanitisation (no secrets ever leak through stored detail blobs).
 */

let server: Server;
let base: string;
const PW = "AdminAudit@123";
const RUN = randomUUID().slice(0, 8);
const ACTION = `AUDIT_TEST_${RUN}`;
const ENTITY = `AuditTestEntity_${RUN}`;
let pwHash: string;

const owned = { userIds: [] as string[], auditIds: [] as string[] };
const SECRET = "top-secret-should-not-leak";

interface Res { status: number; json: Record<string, unknown> | null; setCookie: string[]; }
async function http(method: string, path: string, opts: { cookie?: string } = {}): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
  });
  let json: Res["json"] = null;
  try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function post(path: string, body: unknown): Promise<Res> {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const sc = res.headers as unknown as { getSetCookie?: () => string[] };
  let json: Res["json"] = null; try { json = (await res.json()) as Res["json"]; } catch { json = null; }
  return { status: res.status, json, setCookie: sc.getSetCookie?.() ?? [] };
}
async function login(email: string): Promise<string> {
  const r = await post("/api/v1/auth/login", { email, password: PW });
  const c = r.setCookie.map((x) => x.split(";")[0]!).find((x) => x.startsWith("access_token="));
  if (!c) throw new Error(`login failed ${email}`);
  return c;
}
const dataOf = (r: Res) => (r.json?.data ?? {}) as Record<string, any>;
let mob = 400000000;
const nextMobile = () => `010${(mob++).toString().padStart(8, "0")}`;

async function makeUser(role: "ADMIN" | "OPERATION" | "STUDENT", label: string) {
  const id = randomUUID();
  const email = `aud-${role.toLowerCase()}-${id.slice(0, 8)}@e2e.test`;
  await prisma.user.create({
    data: { id, email, fullName: `AUD ${label} ${RUN}`, mobile: nextMobile(), password: pwHash, role, status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

let adminCookie: string, studentCookie: string, operationCookie: string;
let admin: { id: string; email: string };
let secretLogId: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  admin = await makeUser("ADMIN", "Admin");
  const student = await makeUser("STUDENT", "Student");
  const operation = await makeUser("OPERATION", "Op");
  adminCookie = await login(admin.email);
  studentCookie = await login(student.email);
  operationCookie = await login(operation.email);

  // An audit log carrying sensitive keys (written directly, bypassing the
  // write-time sanitiser) to verify the READ-path sanitiser strips them.
  const secretLog = await prisma.auditLog.create({
    data: {
      action: ACTION,
      resourceType: ENTITY,
      resourceId: `res-${RUN}-1`,
      userId: admin.id,
      actorType: "ADMIN",
      actorName: `AUD Admin ${RUN}`,
      details: {
        amount: 100,
        planCode: "PRO",
        password: SECRET,
        passwordHash: SECRET,
        tokenVersion: SECRET,
        rawCallback: { hmac: SECRET },
        checkoutUrl: `https://pay.example/${SECRET}`,
        resetToken: SECRET,
        otp: SECRET,
        storagePath: `path/${SECRET}.pdf`,
        nested: { authorization: SECRET, safeField: "visible-ok" },
      },
    },
    select: { id: true },
  });
  secretLogId = secretLog.id;
  owned.auditIds.push(secretLogId);

  const other = await prisma.auditLog.create({
    data: { action: ACTION, resourceType: ENTITY, resourceId: `res-${RUN}-2`, userId: admin.id, actorType: "ADMIN", details: { note: "second" } },
    select: { id: true },
  });
  owned.auditIds.push(other.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: owned.auditIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("Admin Audit Logs", () => {
  it("1. ADMIN can list audit logs", async () => {
    const r = await http("GET", "/api/admin/audit-logs?limit=20", { cookie: adminCookie });
    expect(r.status).toBe(200);
    expect(Array.isArray(dataOf(r).data)).toBe(true);
    expect(typeof (dataOf(r).meta as any).total).toBe("number");
  });

  it("2. filters work (action + actorId + entityType)", async () => {
    const r = await http("GET", `/api/admin/audit-logs?action=${ACTION}&limit=50`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const rows = dataOf(r).data as any[];
    expect(rows.length).toBe(2);
    expect(rows.every((x) => x.action === ACTION && x.entityType === ENTITY)).toBe(true);

    const rActor = await http("GET", `/api/admin/audit-logs?actorId=${admin.id}&action=${ACTION}`, { cookie: adminCookie });
    expect((dataOf(rActor).data as any[]).length).toBe(2);

    const rEntity = await http("GET", `/api/admin/audit-logs?entityType=${ENTITY}`, { cookie: adminCookie });
    expect((dataOf(rEntity).data as any[]).length).toBe(2);
  });

  it("3. ADMIN can view detail with the safe shape (actor resolved)", async () => {
    const r = await http("GET", `/api/admin/audit-logs/${secretLogId}`, { cookie: adminCookie });
    expect(r.status).toBe(200);
    const d = dataOf(r);
    expect(d.id).toBe(secretLogId);
    expect(d.action).toBe(ACTION);
    expect(d.entityType).toBe(ENTITY);
    expect(d.actor.email).toBe(admin.email);
    expect(d.createdAt).toBeTruthy();
  });

  it("4. metadata is sanitised (safe fields kept, secret keys stripped)", async () => {
    const r = await http("GET", `/api/admin/audit-logs/${secretLogId}`, { cookie: adminCookie });
    const md = dataOf(r).metadata as Record<string, any>;
    // Safe fields survive.
    expect(md.amount).toBe(100);
    expect(md.planCode).toBe("PRO");
    expect(md.nested.safeField).toBe("visible-ok");
    // Sensitive keys removed / redacted.
    for (const k of ["password", "passwordHash", "tokenVersion", "rawCallback", "checkoutUrl", "resetToken", "otp", "storagePath"]) {
      expect(md[k] === undefined || md[k] === "[REDACTED]").toBe(true);
    }
    expect(md.nested.authorization).toBe("[REDACTED]");
  });

  it("5. secrets never appear anywhere in list or detail responses", async () => {
    const list = await http("GET", `/api/admin/audit-logs?action=${ACTION}&limit=50`, { cookie: adminCookie });
    const detail = await http("GET", `/api/admin/audit-logs/${secretLogId}`, { cookie: adminCookie });
    expect(JSON.stringify(list.json)).not.toContain(SECRET);
    expect(JSON.stringify(detail.json)).not.toContain(SECRET);
  });

  it("6. STUDENT denied (403)", async () => {
    expect((await http("GET", "/api/admin/audit-logs", { cookie: studentCookie })).status).toBe(403);
  });
  it("7. OPERATION denied (403)", async () => {
    expect((await http("GET", "/api/admin/audit-logs", { cookie: operationCookie })).status).toBe(403);
  });
  it("8. unauthenticated denied (401)", async () => {
    expect((await http("GET", "/api/admin/audit-logs")).status).toBe(401);
  });
});
