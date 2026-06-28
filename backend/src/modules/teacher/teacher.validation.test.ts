import { describe, it, expect } from "vitest";
import { updateTeacherProfileSchema } from "./teacher.validation.js";
import {
  AI_TUTOR_LIMIT_MIN,
  AI_TUTOR_LIMIT_MAX,
} from "../ai/tutor/tutor.constants.js";

describe("updateTeacherProfileSchema.aiTutorDailyQueryLimit", () => {
  it("accepts a valid integer cap", () => {
    const r = updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: 30 });
    expect(r.success).toBe(true);
  });

  it("accepts the documented min and max bounds", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: AI_TUTOR_LIMIT_MIN }).success,
    ).toBe(true);
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: AI_TUTOR_LIMIT_MAX }).success,
    ).toBe(true);
  });

  it("rejects a non-integer (float) value", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: 12.5 }).success,
    ).toBe(false);
  });

  it("rejects a non-number value", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: "20" }).success,
    ).toBe(false);
  });

  it("rejects zero (zero is not 'unlimited')", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: 0 }).success,
    ).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: -1 }).success,
    ).toBe(false);
  });

  it("rejects a value above the documented maximum", () => {
    expect(
      updateTeacherProfileSchema.safeParse({ aiTutorDailyQueryLimit: AI_TUTOR_LIMIT_MAX + 1 }).success,
    ).toBe(false);
  });
});
