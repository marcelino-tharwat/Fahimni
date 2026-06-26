import { describe, it, expect } from "vitest";
import { redeemDtoSchema } from "./redeem.dto.js";

const CHAPTER = "11111111-1111-4111-8111-111111111111";
const VALID_CODE = "ABCDEFGH"; // all in the STORY-52 charset

describe("redeemDtoSchema", () => {
  it("accepts a valid body", () => {
    const r = redeemDtoSchema.safeParse({ code: VALID_CODE, chapterId: CHAPTER });
    expect(r.success).toBe(true);
  });

  it("normalizes a lowercase code to uppercase", () => {
    const r = redeemDtoSchema.safeParse({ code: "abcdefgh", chapterId: CHAPTER });
    expect(r.success && r.data.code).toBe("ABCDEFGH");
  });

  it("trims surrounding whitespace on the code", () => {
    const r = redeemDtoSchema.safeParse({ code: "  ABCDEFGH  ", chapterId: CHAPTER });
    expect(r.success && r.data.code).toBe("ABCDEFGH");
  });

  it("rejects an invalid length", () => {
    expect(redeemDtoSchema.safeParse({ code: "ABCDEF", chapterId: CHAPTER }).success).toBe(false);
    expect(redeemDtoSchema.safeParse({ code: "ABCDEFGHIJ", chapterId: CHAPTER }).success).toBe(false);
  });

  it("rejects disallowed characters (0/1/I/L/O ambiguous set)", () => {
    // '0' and 'O' and 'I' and 'L' and '1' are not in the charset.
    expect(redeemDtoSchema.safeParse({ code: "ABCDEFG0", chapterId: CHAPTER }).success).toBe(false);
    expect(redeemDtoSchema.safeParse({ code: "ABCDEFGO", chapterId: CHAPTER }).success).toBe(false);
    expect(redeemDtoSchema.safeParse({ code: "ABCDEFG1", chapterId: CHAPTER }).success).toBe(false);
  });

  it("rejects an invalid chapter UUID", () => {
    expect(redeemDtoSchema.safeParse({ code: VALID_CODE, chapterId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      redeemDtoSchema.safeParse({ code: VALID_CODE, chapterId: CHAPTER, foo: 1 }).success,
    ).toBe(false);
  });

  it("rejects a client-supplied studentId", () => {
    expect(
      redeemDtoSchema.safeParse({ code: VALID_CODE, chapterId: CHAPTER, studentId: "x" }).success,
    ).toBe(false);
  });

  it("rejects client-supplied paymentMethod / isUsed / usedAt / usedByStudentId", () => {
    for (const extra of [
      { paymentMethod: "PROMO" },
      { isUsed: true },
      { usedAt: new Date().toISOString() },
      { usedByStudentId: "x" },
      { enrollmentStatus: "ACTIVE" },
      { createdBy: "x" },
    ]) {
      expect(
        redeemDtoSchema.safeParse({ code: VALID_CODE, chapterId: CHAPTER, ...extra }).success,
      ).toBe(false);
    }
  });

  it("requires both code and chapterId", () => {
    expect(redeemDtoSchema.safeParse({ chapterId: CHAPTER }).success).toBe(false);
    expect(redeemDtoSchema.safeParse({ code: VALID_CODE }).success).toBe(false);
  });
});
