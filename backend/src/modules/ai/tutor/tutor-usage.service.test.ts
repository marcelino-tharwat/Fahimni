import { describe, it, expect, vi } from "vitest";
import { TutorUsageService } from "./tutor-usage.service.js";

function fakePrisma(queryResult: Array<{ count: number }>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(queryResult),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

/** Build a fake enrollment row exposing one teacher's configured cap. */
function enrollmentWithCap(cap: number | null) {
  return {
    chapter: {
      stage: {
        teacher: {
          teacherProfile: cap === null ? null : { aiTutorDailyQueryLimit: cap },
        },
      },
    },
  };
}

describe("TutorUsageService", () => {
  it("formats the UTC calendar day as YYYY-MM-DD", () => {
    const svc = new TutorUsageService();
    expect(svc.utcDateString(new Date("2026-06-28T23:30:00.000Z"))).toBe("2026-06-28");
    expect(svc.utcDateString(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });

  it("tryClaim returns true when the atomic insert/increment returns a row", async () => {
    const prisma = fakePrisma([{ count: 1 }]);
    const svc = new TutorUsageService(prisma as never);
    await expect(svc.tryClaim("s1", 5, "2026-06-28")).resolves.toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("tryClaim returns false when the conditional increment returns no row (limit reached)", async () => {
    const prisma = fakePrisma([]);
    const svc = new TutorUsageService(prisma as never);
    await expect(svc.tryClaim("s1", 5, "2026-06-28")).resolves.toBe(false);
  });

  it("refund issues an update statement", async () => {
    const prisma = fakePrisma([]);
    const svc = new TutorUsageService(prisma as never);
    await svc.refund("s1", "2026-06-28");
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("resetsAt returns the next UTC midnight as ISO-8601 (calendar boundary)", () => {
    const svc = new TutorUsageService();
    expect(svc.resetsAt(new Date("2026-06-28T23:59:59.000Z"))).toBe(
      "2026-06-29T00:00:00.000Z",
    );
    expect(svc.resetsAt(new Date("2026-06-28T00:00:01.000Z"))).toBe(
      "2026-06-29T00:00:00.000Z",
    );
  });

  it("resolveEffectiveLimit returns the MAX teacher cap among active enrollments", async () => {
    const prisma = {
      enrollment: {
        findMany: vi
          .fn()
          .mockResolvedValue([enrollmentWithCap(5), enrollmentWithCap(30)]),
      },
    };
    const svc = new TutorUsageService(prisma as never, 20);
    await expect(svc.resolveEffectiveLimit("s1")).resolves.toBe(30);
  });

  it("resolveEffectiveLimit falls back to the platform default when no cap applies", async () => {
    const prisma = { enrollment: { findMany: vi.fn().mockResolvedValue([]) } };
    const svc = new TutorUsageService(prisma as never, 20);
    await expect(svc.resolveEffectiveLimit("s1")).resolves.toBe(20);
  });

  it("getToday returns used 0 / full remaining when no row exists, without writing", async () => {
    const prisma = { aiTutorUsage: { findUnique: vi.fn().mockResolvedValue(null) } };
    const svc = new TutorUsageService(prisma as never, 20);
    const snap = await svc.getToday("s1", 20, new Date("2026-06-28T10:00:00.000Z"));
    expect(snap).toEqual({
      used: 0,
      limit: 20,
      remaining: 20,
      resetsAt: "2026-06-29T00:00:00.000Z",
    });
  });

  it("getToday computes remaining and never goes negative when used exceeds limit", async () => {
    const prisma = { aiTutorUsage: { findUnique: vi.fn().mockResolvedValue({ count: 8 }) } };
    const svc = new TutorUsageService(prisma as never, 20);
    const snap = await svc.getToday("s1", 5, new Date("2026-06-28T10:00:00.000Z"));
    expect(snap.used).toBe(8);
    expect(snap.limit).toBe(5);
    expect(snap.remaining).toBe(0);
  });
});
