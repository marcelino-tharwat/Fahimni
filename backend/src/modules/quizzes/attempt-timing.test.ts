import { describe, it, expect } from "vitest";
import {
  computeExpiresAt,
  isAttemptExpired,
  resolveQuizDurationMinutes,
} from "./attempt-timing.js";
import { AppError } from "../../shared/utils/AppError.js";

describe("resolveQuizDurationMinutes", () => {
  it("returns configured duration unchanged", () => {
    expect(resolveQuizDurationMinutes(5)).toBe(5);
    expect(resolveQuizDurationMinutes(20)).toBe(20);
    expect(resolveQuizDurationMinutes(45)).toBe(45);
  });

  it("rejects null, zero, and negative values", () => {
    expect(() => resolveQuizDurationMinutes(null)).toThrow(AppError);
    expect(() => resolveQuizDurationMinutes(0)).toThrow(AppError);
    expect(() => resolveQuizDurationMinutes(-5)).toThrow(AppError);
  });
});

describe("computeExpiresAt", () => {
  it("adds duration in UTC milliseconds", () => {
    const started = new Date("2026-07-01T12:00:00.000Z");
    const expires = computeExpiresAt(started, 20);
    expect(expires.toISOString()).toBe("2026-07-01T12:20:00.000Z");
  });
});

describe("isAttemptExpired", () => {
  it("returns false before deadline", () => {
    const expires = new Date("2026-07-01T12:20:00.000Z");
    const now = new Date("2026-07-01T12:19:59.000Z");
    expect(isAttemptExpired(expires, now)).toBe(false);
  });

  it("returns true at or after deadline", () => {
    const expires = new Date("2026-07-01T12:20:00.000Z");
    expect(isAttemptExpired(expires, new Date("2026-07-01T12:20:00.000Z"))).toBe(true);
    expect(isAttemptExpired(expires, new Date("2026-07-01T12:21:00.000Z"))).toBe(true);
  });
});
