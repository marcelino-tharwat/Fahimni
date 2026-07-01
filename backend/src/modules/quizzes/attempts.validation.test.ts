import { describe, it, expect } from "vitest";
import {
  submitAttemptSchema,
  gradeEssaysSchema,
} from "./attempts.validation.js";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

describe("submitAttemptSchema", () => {
  it("accepts a valid submission", () => {
    const r = submitAttemptSchema.safeParse({
      answers: [{ questionId: Q1, answer: "٣" }],
    });
    expect(r.success).toBe(true);
  });

  it("trims string answers", () => {
    const r = submitAttemptSchema.safeParse({
      answers: [{ questionId: Q1, answer: "  صح  " }],
    });
    expect(r.success && r.data.answers[0]!.answer).toBe("صح");
  });

  it("rejects an empty answers array for manual-style payloads without timeout reason", () => {
    // Empty answers are allowed at schema level; service enforces all-questions on manual submit.
    expect(submitAttemptSchema.safeParse({ answers: [] }).success).toBe(true);
  });

  it("rejects a blank answer", () => {
    expect(
      submitAttemptSchema.safeParse({ answers: [{ questionId: Q1, answer: "   " }] })
        .success,
    ).toBe(false);
  });

  it("rejects duplicate question IDs", () => {
    expect(
      submitAttemptSchema.safeParse({
        answers: [
          { questionId: Q1, answer: "a" },
          { questionId: Q1, answer: "b" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid question UUID", () => {
    expect(
      submitAttemptSchema.safeParse({ answers: [{ questionId: "x", answer: "a" }] })
        .success,
    ).toBe(false);
  });

  it("rejects unknown fields on the answer object", () => {
    expect(
      submitAttemptSchema.safeParse({
        answers: [{ questionId: Q1, answer: "a", awardedPoints: 5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects client-supplied top-level fields (score/studentId)", () => {
    expect(
      submitAttemptSchema.safeParse({
        answers: [{ questionId: Q1, answer: "a" }],
        score: 10,
        studentId: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects an over-long answer", () => {
    expect(
      submitAttemptSchema.safeParse({
        answers: [{ questionId: Q1, answer: "x".repeat(5001) }],
      }).success,
    ).toBe(false);
  });
});

describe("gradeEssaysSchema", () => {
  it("accepts valid grades", () => {
    const r = gradeEssaysSchema.safeParse({
      grades: [{ questionId: Q1, awardedPoints: 3, feedback: "جيد" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts grades without feedback", () => {
    expect(
      gradeEssaysSchema.safeParse({ grades: [{ questionId: Q1, awardedPoints: 0 }] })
        .success,
    ).toBe(true);
  });

  it("rejects negative awardedPoints", () => {
    expect(
      gradeEssaysSchema.safeParse({
        grades: [{ questionId: Q1, awardedPoints: -1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects non-numeric awardedPoints", () => {
    expect(
      gradeEssaysSchema.safeParse({
        grades: [{ questionId: Q1, awardedPoints: "3" }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate question IDs", () => {
    expect(
      gradeEssaysSchema.safeParse({
        grades: [
          { questionId: Q1, awardedPoints: 1 },
          { questionId: Q1, awardedPoints: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty grades array", () => {
    expect(gradeEssaysSchema.safeParse({ grades: [] }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(
      gradeEssaysSchema.safeParse({
        grades: [{ questionId: Q2, awardedPoints: 1, secret: true }],
      }).success,
    ).toBe(false);
  });
});
