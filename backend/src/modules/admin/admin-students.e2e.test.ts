import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for the Admin Students Management endpoints. Isolated test DB, self-owned
 * fixtures torn down afterwards. Correctness asserted by recomputation, not
 * absolute globals.
 */

let server: Server;
let base: string;
const PW = "Students@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  paymentIds: [] as string[],
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
      email: `st-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: fullName ?? `ST ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `019${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makeStageChapter(teacherId: string): Promise<string> {
  const stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `st-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(stageId);
  const chapterId = randomUUID();
  await prisma.chapter.create({ data: { id: chapterId, name: `ch-${randomUUID().slice(0, 6)}`, sortOrder: 1, stageId, price: 100 } });
  owned.chapterIds.push(chapterId);
  return chapterId;
}

async function enroll(studentId: string, chapterId: string, status: "ACTIVE" | "PAYMENT_PENDING") {
  await prisma.enrollment.create({ data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status } });
}

async function payment(studentId: string, chapterId: string, status: "SUCCESS" | "PENDING" | "FAILED", amount = 100) {
  const p = await prisma.paymentTransaction.create({
    data: {
      studentId, chapterId, amount, status,
      paymobOrderId: `st-order-${randomUUID()}`,
      paymobTransactionId: `st-txn-${randomUUID()}`,
      rawCallback: { secret: "STUDENT_CALLBACK_SECRET" },
    },
  });
  owned.paymentIds.push(p.id);
}

let adminCookie: string, teacherCookie: string, studentCookie: string;
let teacherA: string, teacherB: string, chapterA: string, chapterB: string;
let sActive: string, sPending: string, sNoEnroll: string, sMulti: string;
const tokenActive = `SACT${randomUUID().slice(0, 6)}`;

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

  teacherA = await makeUser("OPERATION");
  teacherB = await makeUser("OPERATION");
  chapterA = await makeStageChapter(teacherA);
  chapterB = await makeStageChapter(teacherB);

  // Active student (unique token in name for search) — ACTIVE enrollment + SUCCESS payment.
  sActive = await makeUser("STUDENT", `${tokenActive} Active Student`);
  await enroll(sActive, chapterA, "ACTIVE");
  await payment(sActive, chapterA, "SUCCESS");

  // Pending student — PAYMENT_PENDING enrollment + PENDING payment (no active teacher).
  sPending = await makeUser("STUDENT");
  await enroll(sPending, chapterA, "PAYMENT_PENDING");
  await payment(sPending, chapterA, "PENDING");

  // No-enrollment student — zero enrollments.
  sNoEnroll = await makeUser("STUDENT");

  // Multi-teacher student — ACTIVE with both teacher A and teacher B.
  sMulti = await makeUser("STUDENT");
  await enroll(sMulti, chapterA, "ACTIVE");
  await enroll(sMulti, chapterB, "ACTIVE");
});

afterAll(async () => {
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.paymentIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const g = (p: string, cookie = adminCookie) => http("GET", p, { cookie });
const dataOf = (r: HttpResult) => r.json?.data as Record<string, unknown>;
const listIds = (r: HttpResult) => ((dataOf(r).data as { id: string }[]) ?? []).map((s) => s.id);

/** Page through the list with a filter and collect all ids (fixtures + globals). */
async function allIds(filter: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  for (;;) {
    const r = await g(`/api/admin/students?filter=${filter}&page=${page}&limit=100`);
    const rows = (dataOf(r).data as { id: string }[]) ?? [];
    rows.forEach((s) => ids.add(s.id));
    const meta = dataOf(r).meta as { totalPages: number };
    if (page >= meta.totalPages || rows.length === 0) break;
    page += 1;
  }
  return ids;
}

describe("Admin Students — authorization", () => {
  it("1. ADMIN can list students (200)", async () => {
    expect((await g(`/api/admin/students`)).status).toBe(200);
  });
  it("2. unauthenticated denied (401)", async () => {
    expect((await http("GET", `/api/admin/students`)).status).toBe(401);
  });
  it("3. OPERATION denied (403)", async () => {
    expect((await g(`/api/admin/students`, teacherCookie)).status).toBe(403);
  });
  it("4. STUDENT denied (403)", async () => {
    expect((await g(`/api/admin/students`, studentCookie)).status).toBe(403);
  });
});

describe("Admin Students — filters", () => {
  it("5. all filter lists only STUDENT-role users", async () => {
    const ids = [...(await allIds("all"))];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { role: true } });
    expect(users.every((u) => u.role === "STUDENT")).toBe(true);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(4);
  });

  it("6. active filter = students with ≥1 ACTIVE enrollment", async () => {
    const ids = await allIds("active");
    expect(ids.has(sActive)).toBe(true);
    expect(ids.has(sMulti)).toBe(true);
    expect(ids.has(sPending)).toBe(false);
    expect(ids.has(sNoEnroll)).toBe(false);
  });

  it("7. without_enrollment = zero enrollment rows", async () => {
    const ids = await allIds("without_enrollment");
    expect(ids.has(sNoEnroll)).toBe(true);
    expect(ids.has(sPending)).toBe(false); // has a (pending) enrollment
    expect(ids.has(sActive)).toBe(false);
  });

  it("8. without_active_teacher = no ACTIVE enrollment (pending-only + zero)", async () => {
    const ids = await allIds("without_active_teacher");
    expect(ids.has(sPending)).toBe(true);
    expect(ids.has(sNoEnroll)).toBe(true);
    expect(ids.has(sActive)).toBe(false);
    expect(ids.has(sMulti)).toBe(false);
  });

  it("9. payment_pending = pending enrollment or pending payment", async () => {
    const ids = await allIds("payment_pending");
    expect(ids.has(sPending)).toBe(true);
    expect(ids.has(sActive)).toBe(false);
    expect(ids.has(sNoEnroll)).toBe(false);
  });

  it("10. search matches by name (and is scoped to students)", async () => {
    const r = await g(`/api/admin/students?q=${encodeURIComponent(tokenActive)}`);
    const rows = dataOf(r).data as { id: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(sActive);
  });

  it("11. pagination returns correct meta and slices", async () => {
    const r1 = await g(`/api/admin/students?filter=all&page=1&limit=2`);
    const meta = dataOf(r1).meta as { page: number; limit: number; total: number; totalPages: number };
    expect(meta.limit).toBe(2);
    expect(meta.page).toBe(1);
    expect((dataOf(r1).data as unknown[]).length).toBeLessThanOrEqual(2);
    expect(meta.totalPages).toBe(Math.ceil(meta.total / 2));
  });

  it("12. multi-teacher student lists multiple distinct teachers", async () => {
    // The shared DB may hold >100 active students; page through to find sMulti.
    let multi: { id: string; teachers: { id: string }[]; teachersCount: number } | undefined;
    for (let page = 1; !multi; page += 1) {
      const r = await g(`/api/admin/students?filter=active&page=${page}&limit=100`);
      const rows = dataOf(r).data as { id: string; teachers: { id: string }[]; teachersCount: number }[];
      multi = rows.find((s) => s.id === sMulti);
      const meta = dataOf(r).meta as { totalPages: number };
      if (page >= meta.totalPages) break;
    }
    expect(multi).toBeDefined();
    expect(multi!.teachersCount).toBe(2);
    const uniq = new Set(multi!.teachers.map((t) => t.id));
    expect(uniq.size).toBe(2);
    expect(uniq.has(teacherA)).toBe(true);
    expect(uniq.has(teacherB)).toBe(true);
  });
});

describe("Admin Students — detail & safety", () => {
  it("13. detail returns safe identity + summary + teachers", async () => {
    const r = await g(`/api/admin/students/${sMulti}`);
    expect(r.status).toBe(200);
    const d = dataOf(r) as { student: { id: string }; summary: { teachersCount: number }; teachers: unknown[] };
    expect(d.student.id).toBe(sMulti);
    expect(d.summary.teachersCount).toBe(2);
    expect(d.teachers.length).toBe(2);
  });

  it("13b. invalid / non-STUDENT id → 404", async () => {
    expect((await g(`/api/admin/students/${randomUUID()}`)).status).toBe(404);
    expect((await g(`/api/admin/students/not-a-uuid`)).status).toBe(404);
    expect((await g(`/api/admin/students/${teacherA}`)).status).toBe(404); // a teacher id
  });

  it("14. enrollments endpoint returns teacher/chapter/stage info", async () => {
    const r = await g(`/api/admin/students/${sMulti}/enrollments?limit=100`);
    const rows = dataOf(r).data as { chapter: { id: string }; stage: { id: string }; teacher: { id: string } }[];
    expect(rows.length).toBe(2);
    expect(rows.every((e) => e.chapter?.id && e.stage?.id && e.teacher?.id)).toBe(true);
    const teacherIds = new Set(rows.map((e) => e.teacher.id));
    expect(teacherIds.has(teacherA) && teacherIds.has(teacherB)).toBe(true);
  });

  it("15. payments endpoint hides rawCallback/provider secrets", async () => {
    const r = await g(`/api/admin/students/${sActive}/payments`);
    const rows = dataOf(r).data as { amount: number; status: string; chapter: { id: string }; teacher: { id: string } }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((p) => typeof p.amount === "number" && p.chapter?.id && p.teacher?.id)).toBe(true);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/rawCallback|paymobOrderId|paymobTransactionId|STUDENT_CALLBACK_SECRET/i);
  });

  it("learning-summary returns numeric fields safely", async () => {
    const r = await g(`/api/admin/students/${sActive}/learning-summary`);
    const d = dataOf(r) as Record<string, unknown>;
    for (const k of ["quizAttemptsCount", "averageScore", "lessonProgressCount", "completedLessonsCount"]) {
      expect(typeof d[k]).toBe("number");
    }
    expect(["string", "object"]).toContain(typeof d.lastActivityAt); // string | null
  });

  it("16. no sensitive fields across ANY students endpoint", async () => {
    const paths = [
      `/api/admin/students?limit=100`,
      `/api/admin/students/${sActive}`,
      `/api/admin/students/${sActive}/enrollments?limit=100`,
      `/api/admin/students/${sActive}/payments`,
      `/api/admin/students/${sActive}/learning-summary`,
    ];
    for (const p of paths) {
      const raw = JSON.stringify((await g(p)).json);
      expect(raw).not.toMatch(
        /password|tokenVersion|rawCallback|paymobOrderId|paymobTransactionId|storageKey|filePath|STUDENT_CALLBACK_SECRET/i,
      );
    }
  });
});
