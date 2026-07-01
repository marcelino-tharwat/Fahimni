import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { createApp } from "../../../../app.js";
import { prisma } from "../../../../config/database.js";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

const PW = "ConvE2E@123";
let pwHash: string;
let mobileSeq = 0;
let server: Server;
let base: string;

const owned = {
  userIds: [] as string[],
  conversationIds: [] as string[],
  messageIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: { success?: boolean; message?: string; data?: unknown; errors?: unknown } | null;
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

async function login(email: string): Promise<string> {
  const r = await http("POST", "/api/v1/auth/login", { body: { email, password: PW } });
  const cookie = r.setCookie
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function createUser(role: "ADMIN" | "OPERATION" | "STUDENT"): Promise<{
  id: string;
  email: string;
}> {
  const id = randomUUID();
  const email = `conv-${id.slice(0, 8)}@e2e.test`;
  mobileSeq += 1;
  const mobile = `01${String((Date.now() + mobileSeq) % 1_000_000_000).padStart(9, "0")}`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName: `E2E ${role}`,
      mobile,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return { id, email };
}

let student1: { id: string; email: string };
let student2: { id: string; email: string };
let teacher: { id: string; email: string };
let admin: { id: string; email: string };
let s1Cookie: string;
let s2Cookie: string;
let teacherCookie: string;
let adminCookie: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    env: process.env,
    stdio: "pipe",
  });

  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  student1 = await createUser("STUDENT");
  student2 = await createUser("STUDENT");
  teacher = await createUser("OPERATION");
  admin = await createUser("ADMIN");

  s1Cookie = await login(student1.email);
  s2Cookie = await login(student2.email);
  teacherCookie = await login(teacher.email);
  adminCookie = await login(admin.email);
});

afterAll(async () => {
  if (owned.conversationIds.length > 0) {
    await prisma.aiMessage.deleteMany({
      where: { conversationId: { in: owned.conversationIds } },
    });
    await prisma.aiConversation.deleteMany({
      where: { id: { in: owned.conversationIds } },
    });
  }
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("AI Tutor conversations — Express 5 query validation", () => {
  it("GET /api/tutor/conversations succeeds", async () => {
    const r = await http("GET", "/api/tutor/conversations", { cookie: s1Cookie });
    expect(r.status).toBe(200);
    expect(r.json?.success).toBe(true);
  });

  it("GET /api/tutor/conversations?limit=20 succeeds with coerced limit", async () => {
    const r = await http("GET", "/api/tutor/conversations?limit=20", { cookie: s1Cookie });
    expect(r.status).toBe(200);
    expect(r.json?.success).toBe(true);
  });

  it("GET /api/tutor/conversations?archived=false succeeds", async () => {
    const r = await http("GET", "/api/tutor/conversations?archived=false", {
      cookie: s1Cookie,
    });
    expect(r.status).toBe(200);
    expect(r.json?.success).toBe(true);
  });

  it("GET /api/tutor/conversations?limit=invalid returns 400", async () => {
    const r = await http("GET", "/api/tutor/conversations?limit=invalid", {
      cookie: s1Cookie,
    });
    expect(r.status).toBe(400);
    expect(r.json?.message).toBe("Validation error");
  });

  it("GET messages for a conversation succeeds", async () => {
    const create = await http("POST", "/api/tutor/conversations", { cookie: s1Cookie });
    expect(create.status).toBe(201);
    const conversationId = (create.json?.data as { id: string }).id;
    owned.conversationIds.push(conversationId);

    const msg = await prisma.aiMessage.create({
      data: {
        id: randomUUID(),
        conversationId,
        role: "STUDENT",
        content: "سؤال تجريبي للاختبار",
        status: "COMPLETED",
      },
    });
    owned.messageIds.push(msg.id);

    const r = await http(
      "GET",
      `/api/tutor/conversations/${conversationId}/messages`,
      { cookie: s1Cookie },
    );
    expect(r.status).toBe(200);
    expect(r.json?.success).toBe(true);
    const payload = r.json?.data as { data: Array<{ id: string }> };
    expect(payload.data.some((m) => m.id === msg.id)).toBe(true);
  });

  it("GET messages?limit=30 succeeds", async () => {
    const create = await http("POST", "/api/tutor/conversations", { cookie: s1Cookie });
    const conversationId = (create.json?.data as { id: string }).id;
    owned.conversationIds.push(conversationId);

    const r = await http(
      "GET",
      `/api/tutor/conversations/${conversationId}/messages?limit=30`,
      { cookie: s1Cookie },
    );
    expect(r.status).toBe(200);
  });

  it("GET messages?cursor=invalid returns 400", async () => {
    const create = await http("POST", "/api/tutor/conversations", { cookie: s1Cookie });
    const conversationId = (create.json?.data as { id: string }).id;
    owned.conversationIds.push(conversationId);

    const r = await http(
      "GET",
      `/api/tutor/conversations/${conversationId}/messages?cursor=not-a-uuid`,
      { cookie: s1Cookie },
    );
    expect(r.status).toBe(400);
    expect(r.json?.message).toBe("Validation error");
  });

  it("forbids OPERATION and ADMIN from listing conversations", async () => {
    const teacherRes = await http("GET", "/api/tutor/conversations", {
      cookie: teacherCookie,
    });
    expect(teacherRes.status).toBe(403);

    const adminRes = await http("GET", "/api/tutor/conversations", {
      cookie: adminCookie,
    });
    expect(adminRes.status).toBe(403);
  });

  it("prevents cross-student access to another conversation", async () => {
    const create = await http("POST", "/api/tutor/conversations", { cookie: s1Cookie });
    const conversationId = (create.json?.data as { id: string }).id;
    owned.conversationIds.push(conversationId);

    const r = await http(
      "GET",
      `/api/tutor/conversations/${conversationId}/messages`,
      { cookie: s2Cookie },
    );
    expect(r.status).toBe(404);
  });
});
