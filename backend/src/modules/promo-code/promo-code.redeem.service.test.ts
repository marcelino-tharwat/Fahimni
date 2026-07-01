import { describe, it, expect, vi, beforeEach } from "vitest";

// Replace the Prisma singleton with a controllable mock (pure unit tests).
const mockPrisma = vi.hoisted(() => {
  const tx = {
    promoCode: { updateMany: vi.fn() },
    enrollment: { create: vi.fn() },
  };
  return {
    _tx: tx,
    chapter: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    promoCode: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
});
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { PromoCodeService } from "./promo-code.service.js";
import { REDEEM_MESSAGES } from "./promo-code.i18n.js";
import { AppError } from "../../shared/utils/AppError.js";

const STUDENT = "student-1";
const CHAPTER = "chapter-1";
const CODE = "ABCDEFGH";
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

function enrollmentRow() {
  return {
    id: "enr-1",
    studentId: STUDENT,
    chapterId: CHAPTER,
    status: "ACTIVE",
    price: 0,
    paymentMethod: "PROMO",
    promoCodeId: "pc-1",
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    chapter: { id: CHAPTER, name: "ch", description: null, price: null, stageId: "st-1" },
  };
}

function primeHappyPath() {
  mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
  mockPrisma.enrollment.findUnique.mockResolvedValue(null);
  mockPrisma.promoCode.findUnique.mockResolvedValue({ id: "pc-1", isUsed: false, expiresAt: future });
  mockPrisma._tx.promoCode.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma._tx.enrollment.create.mockResolvedValue(enrollmentRow());
}

const svc = new PromoCodeService();

describe("PromoCodeService.redeem (STORY-53)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a PROMO enrollment and marks the code used (happy path)", async () => {
    primeHappyPath();
    const res = await svc.redeem(CODE, STUDENT, CHAPTER, "en");

    expect(res.enrollment.id).toBe("enr-1");
    expect(res.enrollment.paymentMethod).toBe("PROMO");
    expect(res.enrollment.price).toBe(0);
    expect(res.promoCode.isUsed).toBe(true);
    expect(res.promoCode.usedAt).toBeInstanceOf(Date);

    // Claim guards isUsed:false; records usedByStudentId + usedAt from auth.
    const claim = mockPrisma._tx.promoCode.updateMany.mock.calls[0]![0];
    expect(claim.where).toMatchObject({ id: "pc-1", isUsed: false });
    expect(claim.data.isUsed).toBe(true);
    expect(claim.data.usedByStudentId).toBe(STUDENT);
    expect(claim.data.usedAt).toBeInstanceOf(Date);

    // Enrollment uses promo payment method, zero price, linked promo id.
    const create = mockPrisma._tx.enrollment.create.mock.calls[0]![0];
    expect(create.data).toMatchObject({
      studentId: STUDENT,
      chapterId: CHAPTER,
      price: 0,
      paymentMethod: "PROMO",
      promoCodeId: "pc-1",
    });
  });

  it("uses the studentId from the auth context (not any body value)", async () => {
    primeHappyPath();
    await svc.redeem(CODE, "auth-student", CHAPTER, "en");
    expect(mockPrisma._tx.promoCode.updateMany.mock.calls[0]![0].data.usedByStudentId).toBe("auth-student");
    expect(mockPrisma._tx.enrollment.create.mock.calls[0]![0].data.studentId).toBe("auth-student");
  });

  it("rejects an invalid (nonexistent) code with 400 and consumes nothing", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("INVALID_CODE");
    expect(err.message).toBe(REDEEM_MESSAGES.en.invalidCode);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired code with 400 invalid and never claims it", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.findUnique.mockResolvedValue({ id: "pc-1", isUsed: false, expiresAt: past });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("INVALID_CODE");
    expect(err.message).toBe(REDEEM_MESSAGES.en.invalidCode);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an already-used code with 400 already-used", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.findUnique.mockResolvedValue({ id: "pc-1", isUsed: true, expiresAt: future });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("CODE_ALREADY_USED");
    expect(err.message).toBe(REDEEM_MESSAGES.en.alreadyUsed);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an already-enrolled student with 400 and never touches the code", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: "enr-existing" });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("ALREADY_ENROLLED");
    expect(err.message).toBe(REDEEM_MESSAGES.en.alreadyEnrolled);
    expect(mockPrisma.promoCode.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing chapter with 404", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue(null);
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("CHAPTER_NOT_FOUND");
    expect(err.message).toBe(REDEEM_MESSAGES.en.chapterNotFound);
  });

  it("rejects an inactive (soft-deleted) chapter with 404", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: new Date() });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(404);
  });

  it("maps a concurrent claim miss (count 0) to already-used and creates no enrollment", async () => {
    primeHappyPath();
    mockPrisma._tx.promoCode.updateMany.mockResolvedValue({ count: 0 });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("CODE_ALREADY_USED");
    expect(err.message).toBe(REDEEM_MESSAGES.en.alreadyUsed);
    expect(mockPrisma._tx.enrollment.create).not.toHaveBeenCalled();
  });

  it("rolls back the code claim when enrollment creation hits a unique violation (Case B)", async () => {
    primeHappyPath();
    mockPrisma._tx.enrollment.create.mockRejectedValue({ code: "P2002" });
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "en").catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("ALREADY_ENROLLED");
    expect(err.message).toBe(REDEEM_MESSAGES.en.alreadyEnrolled);
    // The claim ran but the surrounding transaction rolls it back in real Postgres.
    expect(mockPrisma._tx.promoCode.updateMany).toHaveBeenCalled();
  });

  it("returns Arabic messages when locale is ar", async () => {
    mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER, deletedAt: null });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    const err = await svc.redeem(CODE, STUDENT, CHAPTER, "ar").catch((e) => e);
    expect(err.message).toBe("الكود غير صالح");
    expect(REDEEM_MESSAGES.ar.alreadyUsed).toBe("تم استخدام هذا الكود من قبل");
    expect(REDEEM_MESSAGES.ar.alreadyEnrolled).toBe("أنت مشترك بالفعل في هذا الفصل");
  });

  it("returns English messages when locale is en", async () => {
    expect(REDEEM_MESSAGES.en.invalidCode).toBe("Invalid code");
    expect(REDEEM_MESSAGES.en.alreadyUsed).toBe("Code already used");
    expect(REDEEM_MESSAGES.en.alreadyEnrolled).toBe("Already enrolled in this chapter");
  });
});
