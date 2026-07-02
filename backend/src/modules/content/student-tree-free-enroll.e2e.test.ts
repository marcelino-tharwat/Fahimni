/**
 * E2E: free-chapter enrollment flips the student tree status free → purchased.
 *
 * Regression guard for the ordering bug in getStudentTree where a free chapter
 * (price 0/null) short-circuited to "free" before the enrolledSet check, so a
 * chapter the student had actively enrolled in never reported "purchased".
 * Mirrors the manual Postman flow: tree → /enrollments/free → tree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { prisma } from "../../config/database.js";

let server: Server;
let base: string;
const PW = "FreeEnrollE2E@123";
let pwHash: string;
let mobileSeq = 0;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
};

interface HttpResult {
  status: number;
  json: { success?: boolean; message?: string; code?: string; data?: unknown } | null;
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

function mobile(): string {
  // Random 8-digit tail keeps the number unique across runs even if a prior
  // run's cleanup was interrupted (no fixed sequence to collide on).
  mobileSeq += 1;
  const tail = (parseInt(randomUUID().replace(/\D/g, "").slice(0, 7) || "0", 10) * 10 + mobileSeq)
    .toString()
    .padStart(8, "0")
    .slice(-8);
  return "010" + tail;
}

/** Locate a chapter's enrollmentStatus in the student tree response. */
function statusOf(tree: unknown, chapterId: string): string | undefined {
  for (const stage of tree as Array<{ chapters: Array<{ chapter: { id: string; enrollmentStatus: string } }> }>) {
    const hit = stage.chapters.find((c) => c.chapter.id === chapterId);
    if (hit) return hit.chapter.enrollmentStatus;
  }
  return undefined;
}

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 10);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { chapterId: { in: owned.chapterIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  // The free enrollment records a STUDENT_ENROLLED audit log (userId RESTRICT
  // FK), so it must be cleared before the users it references.
  await prisma.auditLog.deleteMany({ where: { userId: { in: owned.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("student tree — free enrollment flips free → purchased", () => {
  it("reports 'free' before enrolling and 'purchased' after /enrollments/free", async () => {
    const suffix = randomUUID().slice(0, 8);

    // A teacher owns the stage; a student does the enrolling.
    const teacher = await prisma.user.create({
      data: {
        fullName: "Free Enroll Teacher",
        email: `t.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "OPERATION",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(teacher.id);

    const student = await prisma.user.create({
      data: {
        fullName: "Free Enroll Student",
        email: `s.${suffix}@e2e.local`,
        mobile: mobile(),
        password: pwHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    owned.userIds.push(student.id);

    const stage = await prisma.stage.create({
      data: { name: `Stage ${suffix}`, sortOrder: 1, teacherId: teacher.id },
    });
    owned.stageIds.push(stage.id);

    // price 0 → a free chapter.
    const chapter = await prisma.chapter.create({
      data: { name: `Free Chapter ${suffix}`, sortOrder: 1, price: 0, stageId: stage.id },
    });
    owned.chapterIds.push(chapter.id);

    const studentCookie = await login(student.email);

    // 1) Before enrolling → free chapter shows "free".
    const before = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(before.status).toBe(200);
    expect(statusOf(before.json, chapter.id)).toBe("free");

    // 2) Enroll in the free chapter.
    const enroll = await http("POST", "/api/enrollments/free", {
      cookie: studentCookie,
      body: { chapterId: chapter.id },
    });
    expect(enroll.status).toBe(201);

    // 3) After enrolling → same chapter now shows "purchased" (the fix).
    const after = await http("GET", "/api/content/student/tree", { cookie: studentCookie });
    expect(after.status).toBe(200);
    expect(statusOf(after.json, chapter.id)).toBe("purchased");
  });
});
