import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

// Regression tests for the promo-codes-paid-chapters-only fix: promo codes
// grant free access to a chapter, which is meaningless for a chapter that's
// already free — the backend must reject targeting one, re-deriving free/paid
// from the DB (never trusting a client-supplied flag).

const mockPrisma = vi.hoisted(() => ({
  promoCode: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  chapter: { findFirst: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { PromoCodeService } from "./promo-code.service.js";
import { AppError } from "../../shared/utils/AppError.js";

const service = new PromoCodeService();
const TEACHER = randomUUID();
const CHAPTER = randomUUID();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PromoCodeService.create — free chapters are rejected", () => {
  it("1. succeeds for a paid chapter (price > 0) — existing behavior preserved", async () => {
    mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER, price: 150 });
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.create.mockResolvedValue({ id: randomUUID(), code: "ABCD2345" });

    const result = await service.create(TEACHER, CHAPTER, TEACHER);

    expect(result.code).toBe("ABCD2345");
    expect(mockPrisma.promoCode.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chapterId: CHAPTER }) }),
    );
  });

  it("2. rejects a null-price (free) chapter with 400 PROMO_TARGET_MUST_BE_PAID", async () => {
    mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER, price: null });

    await expect(service.create(TEACHER, CHAPTER, TEACHER)).rejects.toMatchObject({
      statusCode: 400,
      code: "PROMO_TARGET_MUST_BE_PAID",
    });
    expect(mockPrisma.promoCode.create).not.toHaveBeenCalled();
  });

  it("3. rejects a zero-price (free) chapter the same way", async () => {
    mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER, price: 0 });

    await expect(service.create(TEACHER, CHAPTER, TEACHER)).rejects.toBeInstanceOf(AppError);
    expect(mockPrisma.promoCode.create).not.toHaveBeenCalled();
  });

  it("4. never trusts a client-supplied flag — only the DB-loaded chapter.price decides", async () => {
    // No matter what extra properties a caller might smuggle onto the input,
    // `create()`'s signature only accepts (createdById, chapterId, ownerTeacherId) —
    // there is no isPaid/isFree parameter to spoof. This test documents that
    // the free/paid decision is 100% server-derived from prisma.chapter.findFirst.
    mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER, price: null });

    await expect(
      service.create(TEACHER, CHAPTER, TEACHER),
    ).rejects.toMatchObject({ code: "PROMO_TARGET_MUST_BE_PAID" });
    expect(mockPrisma.chapter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ price: true }) }),
    );
  });
});
