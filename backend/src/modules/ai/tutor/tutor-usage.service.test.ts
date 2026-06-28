import { describe, it, expect, vi } from "vitest";
import { TutorUsageService } from "./tutor-usage.service.js";

function fakePrisma(queryResult: Array<{ count: number }>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(queryResult),
    $executeRaw: vi.fn().mockResolvedValue(1),
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
});
