import { describe, it, expect } from "vitest";
import {
  computeStatus,
  completedMonths,
} from "./student-engagement.service.js";

const DAY = 24 * 60 * 60 * 1000;

describe("computeStatus", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");

  it("is active exactly on the 30-day boundary (inclusive)", () => {
    expect(computeStatus(new Date(now.getTime() - 30 * DAY), now)).toBe("active");
  });

  it("is active within the window", () => {
    expect(computeStatus(new Date(now.getTime() - 5 * DAY), now)).toBe("active");
  });

  it("is inactive past 30 days", () => {
    expect(computeStatus(new Date(now.getTime() - 31 * DAY), now)).toBe("inactive");
  });

  it("uses the server-provided now, so a client timezone cannot shift the cutoff", () => {
    // Same enrollment instant, evaluated against a fixed server 'now'.
    const enroll = new Date("2026-06-10T23:00:00.000Z");
    expect(computeStatus(enroll, now)).toBe("active");
  });
});

describe("completedMonths", () => {
  it("counts whole calendar months", () => {
    expect(completedMonths(new Date("2026-03-15T00:00:00Z"), new Date("2026-06-15T00:00:00Z"))).toBe(3);
  });

  it("does not count a partial month", () => {
    expect(completedMonths(new Date("2026-03-15T00:00:00Z"), new Date("2026-06-14T00:00:00Z"))).toBe(2);
  });

  it("returns 0 for an enrollment less than a month old", () => {
    expect(completedMonths(new Date("2026-06-20T00:00:00Z"), new Date("2026-06-29T00:00:00Z"))).toBe(0);
  });

  it("never returns a negative value for a future date", () => {
    expect(completedMonths(new Date("2027-01-01T00:00:00Z"), new Date("2026-06-29T00:00:00Z"))).toBe(0);
  });

  it("crosses a year boundary correctly", () => {
    expect(completedMonths(new Date("2025-12-01T00:00:00Z"), new Date("2026-06-01T00:00:00Z"))).toBe(6);
  });
});
