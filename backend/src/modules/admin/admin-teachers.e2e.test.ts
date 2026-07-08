import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

/**
 * E2E for GET /api/admin/teachers. The test DB is shared, so per-teacher
 * correctness is asserted by independent recomputation (never absolute globals),
 * and the fixtures are fully torn down afterwards.
 */

let server: Server;
let base: string;
const PW = "AdminTeachers@123";
let pwHash: string;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
  quizIds: [] as string[],
  paymentIds: [] as string[],
  planIds: [] as string[],
  subPaymentIds: [] as string[],
  subscriptionIds: [] as string[],
  aiEventIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: Record<string, unknown> | null;
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

async function makeUser(
  role: "ADMIN" | "OPERATION" | "STUDENT",
  fullName?: string,
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `teach-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`,
      fullName: fullName ?? `Teach ${role} ${randomUUID().slice(0, 4)}`,
      mobile: `017${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function makeStageChapter(teacherId: string): Promise<{ stageId: string; chapterId: string }> {
  const stageId = randomUUID();
  await prisma.stage.create({ data: { id: stageId, name: `st-${randomUUID().slice(0, 6)}`, sortOrder: 1, teacherId } });
  owned.stageIds.push(stageId);
  const chapterId = randomUUID();
  await prisma.chapter.create({ data: { id: chapterId, name: `ch-${randomUUID().slice(0, 6)}`, sortOrder: 1, stageId, price: 100 } });
  owned.chapterIds.push(chapterId);
  return { stageId, chapterId };
}

async function enroll(studentId: string, chapterId: string, status: "ACTIVE" | "PAYMENT_PENDING") {
  await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "FREE", status },
  });
}

async function successPayment(studentId: string, chapterId: string, amount: number) {
  const p = await prisma.paymentTransaction.create({
    data: { studentId, chapterId, amount, status: "SUCCESS", paymobOrderId: `teach-${randomUUID()}` },
  });
  owned.paymentIds.push(p.id);
}

async function makePlan(): Promise<string> {
  const plan = await prisma.teacherPlan.create({
    data: { code: `TEACH-${randomUUID().slice(0, 8)}`, name: "teach-plan", displayName: "Teach Plan", monthlyPrice: 199 },
  });
  owned.planIds.push(plan.id);
  return plan.id;
}

async function subPayment(teacherId: string, planId: string, amount: number, status: "SUCCESS" | "PENDING") {
  const p = await prisma.teacherSubscriptionPayment.create({
    data: {
      teacherId,
      planId,
      amount,
      status,
      provider: "PAYMOB",
      providerOrderId: `teach-sub-${randomUUID()}`,
      rawCallback: { secret: "should-never-be-exposed" },
    },
  });
  owned.subPaymentIds.push(p.id);
}

let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

// Fixture teachers.
let teacherA: string; // course revenue + SUCCESS subscription payment
let teacherB: string; // shares a student with A + a PENDING subscription payment
let chapterA: string;
let chapterB: string;
let sharedStudent: string;
const tokenA = `TQAAA${randomUUID().slice(0, 6)}`;
const tokenShared = `TSHARE${randomUUID().slice(0, 6)}`;
const COURSE_AMOUNT = 4321;
const SUB_AMOUNT = 913;

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const adminId = await makeUser("ADMIN");
  const teacherId = await makeUser("OPERATION");
  const studentId = await makeUser("STUDENT");
  adminCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).email);
  teacherCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: teacherId } })).email);
  studentCookie = await login((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).email);

  // Two teachers that share a common search token (for pagination) plus a unique
  // token on A (for search).
  teacherA = await makeUser("OPERATION", `${tokenShared} ${tokenA} Alpha`);
  teacherB = await makeUser("OPERATION", `${tokenShared} Beta`);

  ({ chapterId: chapterA } = await makeStageChapter(teacherA));
  ({ chapterId: chapterB } = await makeStageChapter(teacherB));

  // Shared student enrolled with BOTH teachers → must be counted for each.
  sharedStudent = await makeUser("STUDENT");
  await enroll(sharedStudent, chapterA, "ACTIVE");
  await enroll(sharedStudent, chapterB, "ACTIVE");

  // A second student only with teacher A.
  const soloStudent = await makeUser("STUDENT");
  await enroll(soloStudent, chapterA, "ACTIVE");

  // Teacher A course revenue (a student paying for A's chapter).
  const payer = await makeUser("STUDENT");
  await successPayment(payer, chapterA, COURSE_AMOUNT);

  // Teacher A pays the platform (SUCCESS subscription payment) — separate value.
  const planId = await makePlan();
  await subPayment(teacherA, planId, SUB_AMOUNT, "SUCCESS");

  // Teacher B has a PENDING subscription payment.
  await subPayment(teacherB, planId, 555, "PENDING");
});

afterAll(async () => {
  await prisma.teacherSubscriptionPayment.deleteMany({ where: { id: { in: owned.subPaymentIds } } });
  await prisma.teacherSubscription.deleteMany({ where: { id: { in: owned.subscriptionIds } } });
  await prisma.teacherAiUsageEvent.deleteMany({ where: { id: { in: owned.aiEventIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: owned.paymentIds } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: owned.userIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.teacherPlan.deleteMany({ where: { id: { in: owned.planIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

type Teacher = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  status: string;
  profile: { subject: string | null; photoUrl: string | null };
  stats: {
    stagesCount: number;
    chaptersCount: number;
    lessonsCount: number;
    quizzesCount: number;
    studentsCount: number;
    enrollmentsCount: number;
    confirmedCourseRevenue: number;
    confirmedSubscriptionPayments: number;
    monthlyConfirmedCourseRevenue: number;
    aiUsage: number;
  };
  currentSubscription: unknown;
  pendingSubscriptionPayment: { amount: number; currency: string } | null;
  createdAt: string;
};

type ListResult = {
  data: Teacher[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function list(query = "", cookie = adminCookie): Promise<HttpResult> {
  return http("GET", `/api/admin/teachers${query}`, { cookie });
}

async function listData(query = ""): Promise<ListResult> {
  return (await list(query)).json?.data as ListResult;
}

/** Fetch exactly one teacher by a unique search token. */
async function findOne(token: string): Promise<Teacher> {
  const d = await listData(`?q=${encodeURIComponent(token)}&limit=100`);
  expect(d.data.length).toBeGreaterThanOrEqual(1);
  return d.data[0]!;
}

async function distinctStudents(teacherId: string): Promise<number> {
  const rows = await prisma.enrollment.findMany({
    where: { chapter: { stage: { teacherId } } },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  return rows.length;
}

async function courseRevenue(teacherId: string): Promise<number> {
  const agg = await prisma.paymentTransaction.aggregate({
    where: { status: "SUCCESS", chapter: { stage: { teacherId } } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

describe("GET /api/admin/teachers — authorization", () => {
  it("1. allows ADMIN (200)", async () => {
    expect((await list()).status).toBe(200);
  });
  it("2. rejects unauthenticated (401)", async () => {
    expect((await http("GET", "/api/admin/teachers")).status).toBe(401);
  });
  it("3. rejects OPERATION/teacher (403)", async () => {
    expect((await list("", teacherCookie)).status).toBe(403);
  });
  it("4. rejects STUDENT (403)", async () => {
    expect((await list("", studentCookie)).status).toBe(403);
  });
});

describe("GET /api/admin/teachers — payload & filters", () => {
  it("only lists OPERATION-role users", async () => {
    const d = await listData("?limit=100");
    const roles = await prisma.user.findMany({
      where: { id: { in: d.data.map((t) => t.id) } },
      select: { role: true },
    });
    expect(roles.every((r) => r.role === "OPERATION")).toBe(true);
  });

  it("5. search (q) filters by name/email/mobile", async () => {
    const d = await listData(`?q=${encodeURIComponent(tokenA)}`);
    expect(d.data.length).toBe(1);
    expect(d.data[0]!.id).toBe(teacherA);
  });

  it("6. pagination returns correct meta and slices", async () => {
    const page1 = await listData(`?q=${encodeURIComponent(tokenShared)}&page=1&limit=1`);
    expect(page1.meta.total).toBe(2);
    expect(page1.meta.limit).toBe(1);
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.totalPages).toBe(2);
    expect(page1.data.length).toBe(1);

    const page2 = await listData(`?q=${encodeURIComponent(tokenShared)}&page=2&limit=1`);
    expect(page2.data.length).toBe(1);
    expect(page2.data[0]!.id).not.toBe(page1.data[0]!.id);
  });

  it("7. shared student is counted for BOTH teachers (per-teacher scoping)", async () => {
    const a = await findOne(tokenA);
    const b = (await listData(`?q=${encodeURIComponent(tokenShared)}&limit=100`)).data.find(
      (t) => t.id === teacherB,
    )!;

    const [expectedA, expectedB] = await Promise.all([
      distinctStudents(teacherA),
      distinctStudents(teacherB),
    ]);
    expect(a.stats.studentsCount).toBe(expectedA);
    expect(b.stats.studentsCount).toBe(expectedB);
    // Both include the shared student → each is at least 1.
    expect(a.stats.studentsCount).toBeGreaterThanOrEqual(2); // shared + solo
    expect(b.stats.studentsCount).toBeGreaterThanOrEqual(1); // shared
  });

  it("8. confirmedCourseRevenue is scoped to the teacher's own content", async () => {
    const a = await findOne(tokenA);
    expect(a.stats.confirmedCourseRevenue).toBe(await courseRevenue(teacherA));
    expect(a.stats.confirmedCourseRevenue).toBeGreaterThanOrEqual(COURSE_AMOUNT);

    // Teacher B never received a course payment → its course revenue excludes A's.
    const b = (await listData(`?q=${encodeURIComponent(tokenShared)}&limit=100`)).data.find(
      (t) => t.id === teacherB,
    )!;
    expect(b.stats.confirmedCourseRevenue).toBe(await courseRevenue(teacherB));
    expect(b.stats.confirmedCourseRevenue).toBe(0);
  });

  it("9. subscription payments are reported SEPARATELY from course revenue", async () => {
    const a = await findOne(tokenA);
    const subAgg = await prisma.teacherSubscriptionPayment.aggregate({
      where: { teacherId: teacherA, status: "SUCCESS" },
      _sum: { amount: true },
    });
    expect(a.stats.confirmedSubscriptionPayments).toBe(Number(subAgg._sum.amount ?? 0));
    expect(a.stats.confirmedSubscriptionPayments).toBeGreaterThanOrEqual(SUB_AMOUNT);
    // The subscription amount must NOT be folded into course revenue.
    expect(a.stats.confirmedCourseRevenue).toBe(await courseRevenue(teacherA));
    expect(a.stats.confirmedCourseRevenue).not.toBe(a.stats.confirmedSubscriptionPayments);

    // Teacher B's PENDING subscription payment surfaces (safe fields only).
    const b = (await listData(`?q=${encodeURIComponent(tokenShared)}&limit=100`)).data.find(
      (t) => t.id === teacherB,
    )!;
    expect(b.pendingSubscriptionPayment).not.toBeNull();
    expect(b.pendingSubscriptionPayment!.amount).toBe(555);
  });

  it("content/stat shape is present and numeric", async () => {
    const a = await findOne(tokenA);
    for (const k of [
      "stagesCount", "chaptersCount", "lessonsCount", "quizzesCount",
      "studentsCount", "enrollmentsCount", "confirmedCourseRevenue",
      "confirmedSubscriptionPayments", "monthlyConfirmedCourseRevenue", "aiUsage",
    ] as const) {
      expect(typeof a.stats[k]).toBe("number");
    }
    expect(a.stats.stagesCount).toBeGreaterThanOrEqual(1);
    expect(a.stats.chaptersCount).toBeGreaterThanOrEqual(1);
  });

  it("10. never exposes sensitive fields", async () => {
    const r = await list(`?q=${encodeURIComponent(tokenShared)}&limit=100`);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(
      /password|tokenVersion|rawCallback|providerOrderId|providerTransactionId|checkoutUrl|storageKey|filePath|should-never-be-exposed/i,
    );
  });
});
