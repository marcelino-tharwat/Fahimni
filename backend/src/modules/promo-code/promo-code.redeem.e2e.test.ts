import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";
import { CODE_CHARSET } from "./promo-code.service.js";
import { REDEEM_MESSAGES } from "./promo-code.i18n.js";
import type { Role } from "../../generated/prisma/client.js";

let server: Server;
let base: string;
const PW = "Promo53E2E@123";
let pwHash: string;
let mobileSeq = 0;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  codeIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: { success?: boolean; message?: string; data?: unknown } | null;
  setCookie: string[];
}

async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; acceptLanguage?: string } = {},
): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...(opts.acceptLanguage ? { "Accept-Language": opts.acceptLanguage } : {}),
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
  const cookie = r.setCookie.map((c) => c.split(";")[0]!).find((c) => c.startsWith("access_token="));
  if (!cookie) throw new Error(`login failed for ${email}: ${r.status}`);
  return cookie;
}

async function createUser(role: Role): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `promo53-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}@e2e.test`;
  mobileSeq += 1;
  await prisma.user.create({
    data: { id, email, fullName: `Promo53 ${role}`, mobile: `017${String(mobileSeq).padStart(8, "0")}`, password: pwHash, role, status: "ACTIVE" },
  });
  owned.userIds.push(id);
  return { id, email };
}

async function createChapter(stageId: string): Promise<string> {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name: `ch-${randomUUID().slice(0, 6)}`, sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}

function mkCodeStr(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  return s;
}

async function createCode(opts: { expiresInDays?: number } = {}): Promise<string> {
  const code = mkCodeStr();
  const expiresAt = new Date(Date.now() + (opts.expiresInDays ?? 365) * 86_400_000);
  const row = await prisma.promoCode.create({ data: { code, createdById: admin.id, expiresAt }, select: { id: true } });
  owned.codeIds.push(row.id);
  return code;
}

let admin: { id: string; email: string };
let teacher: { id: string; email: string };
let s1: { id: string; email: string };
let s2: { id: string; email: string };
let stageId: string;
let s1Cookie: string;
let s2Cookie: string;
let teacherCookie: string;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  admin = await createUser("ADMIN");
  teacher = await createUser("OPERATION");
  s1 = await createUser("STUDENT");
  s2 = await createUser("STUDENT");
  stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `stage-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId: teacher.id } });
  owned.stageIds.push(stageId);

  s1Cookie = await login(s1.email);
  s2Cookie = await login(s2.email);
  teacherCookie = await login(teacher.email);
});

afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.promoCode.deleteMany({ where: { id: { in: owned.codeIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("STORY-53 — promo code redemption E2E", () => {
  it("redeems a valid code: enrollment + code consumed + appears in my-courses", async () => {
    const chapterId = await createChapter(stageId);
    const code = await createCode();

    const r = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code, chapterId } });
    expect(r.status).toBe(201);
    const data = r.json?.data as { enrollment: { paymentMethod: string; status: string; studentId: string }; promoCode: { isUsed: boolean } };
    expect(data.enrollment.paymentMethod).toBe("PROMO");
    expect(data.enrollment.status).toBe("ACTIVE");
    expect(data.enrollment.studentId).toBe(s1.id);
    expect(data.promoCode.isUsed).toBe(true);

    // DB: code marked used by s1 with a timestamp; exactly one enrollment.
    const pc = await prisma.promoCode.findUniqueOrThrow({ where: { code }, select: { isUsed: true, usedByStudentId: true, usedAt: true } });
    expect(pc.isUsed).toBe(true);
    expect(pc.usedByStudentId).toBe(s1.id);
    expect(pc.usedAt).not.toBeNull();
    expect(await prisma.enrollment.count({ where: { studentId: s1.id, chapterId } })).toBe(1);

    // Chapter now appears in the student's real course list.
    const mc = await http("GET", "/api/content/student/my-courses", { cookie: s1Cookie });
    expect(mc.status).toBe(200);
    expect((mc.json?.data as Array<{ id: string }>).some((c) => c.id === chapterId)).toBe(true);
  });

  it("rejects an invalid code with 400 (Arabic + English) and creates no enrollment", async () => {
    const chapterId = await createChapter(stageId);
    const bogus = mkCodeStr(); // never inserted

    const en = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code: bogus, chapterId } });
    expect(en.status).toBe(400);
    expect(en.json?.message).toBe(REDEEM_MESSAGES.en.invalidCode);

    const ar = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code: bogus, chapterId }, acceptLanguage: "ar" });
    expect(ar.status).toBe(400);
    expect(ar.json?.message).toBe(REDEEM_MESSAGES.ar.invalidCode);

    expect(await prisma.enrollment.count({ where: { studentId: s1.id, chapterId } })).toBe(0);
  });

  it("rejects an expired code with 400 and leaves it unused", async () => {
    const chapterId = await createChapter(stageId);
    const code = await createCode({ expiresInDays: -1 });

    const r = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code, chapterId } });
    expect(r.status).toBe(400);
    const pc = await prisma.promoCode.findUniqueOrThrow({ where: { code }, select: { isUsed: true } });
    expect(pc.isUsed).toBe(false);
    expect(await prisma.enrollment.count({ where: { studentId: s1.id, chapterId } })).toBe(0);
  });

  it("rejects a second student reusing an already-used code (400 already used)", async () => {
    const chapterId1 = await createChapter(stageId);
    const chapterId2 = await createChapter(stageId);
    const code = await createCode();

    const first = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code, chapterId: chapterId1 } });
    expect(first.status).toBe(201);

    const second = await http("POST", "/api/promo-codes/redeem", { cookie: s2Cookie, body: { code, chapterId: chapterId2 } });
    expect(second.status).toBe(400);
    expect(second.json?.message).toBe(REDEEM_MESSAGES.en.alreadyUsed);
    expect(await prisma.enrollment.count({ where: { studentId: s2.id, chapterId: chapterId2 } })).toBe(0);
  });

  it("rejects an already-enrolled student (400) and leaves the fresh code unused", async () => {
    const chapterId = await createChapter(stageId);
    await prisma.enrollment.create({ data: { studentId: s1.id, chapterId, price: 0, paymentMethod: "CASH" } });
    const code = await createCode();

    const r = await http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code, chapterId } });
    expect(r.status).toBe(400);
    expect(r.json?.message).toBe(REDEEM_MESSAGES.en.alreadyEnrolled);

    const pc = await prisma.promoCode.findUniqueOrThrow({ where: { code }, select: { isUsed: true } });
    expect(pc.isUsed).toBe(false); // not consumed
  });

  it("requires authentication (401) and student role (403)", async () => {
    const chapterId = await createChapter(stageId);
    const code = await createCode();

    const noAuth = await http("POST", "/api/promo-codes/redeem", { body: { code, chapterId } });
    expect(noAuth.status).toBe(401);

    const asTeacher = await http("POST", "/api/promo-codes/redeem", { cookie: teacherCookie, body: { code, chapterId } });
    expect(asTeacher.status).toBe(403);

    const pc = await prisma.promoCode.findUniqueOrThrow({ where: { code }, select: { isUsed: true } });
    expect(pc.isUsed).toBe(false);
  });

  it("Case A — two students, same code concurrently → one wins, code unused→winner only", async () => {
    const chA = await createChapter(stageId);
    const chB = await createChapter(stageId);
    const code = await createCode();

    const [a, b] = await Promise.all([
      http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code, chapterId: chA } }),
      http("POST", "/api/promo-codes/redeem", { cookie: s2Cookie, body: { code, chapterId: chB } }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    const pc = await prisma.promoCode.findUniqueOrThrow({ where: { code }, select: { usedByStudentId: true, isUsed: true } });
    expect(pc.isUsed).toBe(true);
    const winner = a.status === 201 ? s1.id : s2.id;
    expect(pc.usedByStudentId).toBe(winner);
    // Exactly one enrollment total across both target chapters.
    const total = await prisma.enrollment.count({
      where: {
        OR: [
          { studentId: s1.id, chapterId: chA },
          { studentId: s2.id, chapterId: chB },
        ],
      },
    });
    expect(total).toBe(1);
  });

  it("Case B — one student, two codes, same chapter concurrently → one enrollment, one code used", async () => {
    const chapterId = await createChapter(stageId);
    const code1 = await createCode();
    const code2 = await createCode();

    const [a, b] = await Promise.all([
      http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code: code1, chapterId } }),
      http("POST", "/api/promo-codes/redeem", { cookie: s1Cookie, body: { code: code2, chapterId } }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    // Exactly one enrollment.
    expect(await prisma.enrollment.count({ where: { studentId: s1.id, chapterId } })).toBe(1);
    // Exactly one of the two codes consumed; the loser stays unused.
    const codes = await prisma.promoCode.findMany({ where: { code: { in: [code1, code2] } }, select: { isUsed: true } });
    expect(codes.filter((c) => c.isUsed).length).toBe(1);
    expect(codes.filter((c) => !c.isUsed).length).toBe(1);
  });
});
