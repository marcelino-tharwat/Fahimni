import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

// ─── Prisma mock ─────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  promoCode: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  chapter: { findFirst: vi.fn() },
  // findAll uses prisma.$transaction([...]) — resolve the array of promises.
  $transaction: vi.fn(
    async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  ),
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { PromoCodeService } from "./promo-code.service.js";
import { AppError } from "../../shared/utils/AppError.js";

const service = new PromoCodeService();

const TEACHER_A = randomUUID();
const TEACHER_B = randomUUID();
const CHAPTER_A = randomUUID();
const CHAPTER_B = randomUUID();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PromoCodeService ownership scoping", () => {
  describe("findAll", () => {
    it("scopes the list to the teacher's own codes when ownerTeacherId is given", async () => {
      mockPrisma.promoCode.count.mockResolvedValue(0);
      mockPrisma.promoCode.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, isUsed: undefined }, TEACHER_A);

      expect(mockPrisma.promoCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdById: TEACHER_A } }),
      );
      expect(mockPrisma.promoCode.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdById: TEACHER_A } }),
      );
    });

    it("combines createdById with the isUsed filter", async () => {
      mockPrisma.promoCode.count.mockResolvedValue(0);
      mockPrisma.promoCode.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, isUsed: true }, TEACHER_A);

      expect(mockPrisma.promoCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isUsed: true, createdById: TEACHER_A } }),
      );
    });

    it("does NOT scope by createdById for an admin (no ownerTeacherId)", async () => {
      mockPrisma.promoCode.count.mockResolvedValue(0);
      mockPrisma.promoCode.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, isUsed: undefined });

      expect(mockPrisma.promoCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe("create", () => {
    it("requires the chapter to belong to the teacher when ownerTeacherId is given", async () => {
      // Chapter B is not owned by Teacher A → scoped query returns null.
      mockPrisma.chapter.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TEACHER_A, CHAPTER_B, TEACHER_A),
      ).rejects.toThrowError(new AppError("Chapter not found", 404, "CHAPTER_NOT_FOUND"));

      expect(mockPrisma.chapter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: CHAPTER_B,
            teacherId: TEACHER_A, deletedAt: null,
          }),
        }),
      );
      expect(mockPrisma.promoCode.create).not.toHaveBeenCalled();
    });

    it("creates the code when the teacher owns the chapter", async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER_A });
      mockPrisma.promoCode.findUnique.mockResolvedValue(null); // unique code
      mockPrisma.promoCode.create.mockResolvedValue({ id: randomUUID(), code: "ABCD2345" });

      await service.create(TEACHER_A, CHAPTER_A, TEACHER_A);

      expect(mockPrisma.promoCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: TEACHER_A, chapterId: CHAPTER_A }),
        }),
      );
    });

    it("admin (no ownerTeacherId) may target any chapter without the stage scope", async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER_B });
      mockPrisma.promoCode.findUnique.mockResolvedValue(null);
      mockPrisma.promoCode.create.mockResolvedValue({ id: randomUUID(), code: "WXYZ2345" });

      await service.create(TEACHER_B, CHAPTER_B);

      const call = mockPrisma.chapter.findFirst.mock.calls[0]![0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).not.toHaveProperty("teacherId");
    });
  });
});
