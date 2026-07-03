import { describe, expect, it } from "vitest";
import { deriveQuizDisplayStatus } from "./quiz-attempt-display.js";

describe("deriveQuizDisplayStatus", () => {
  it("returns new when no attempt", () => {
    expect(deriveQuizDisplayStatus(undefined, null)).toEqual({ status: "new" });
  });

  it("returns pending for in-progress attempt", () => {
    expect(
      deriveQuizDisplayStatus(
        { status: "IN_PROGRESS", score: null, totalPoints: 10 },
        50,
      ),
    ).toEqual({ status: "pending" });
  });

  it("uses passingScore when set", () => {
    expect(
      deriveQuizDisplayStatus(
        { status: "GRADED", score: 4, totalPoints: 10 },
        50,
      ),
    ).toEqual({ status: "failed", score: 40, retakeAllowed: true });
  });

  it("passes when graded and no passingScore", () => {
    expect(
      deriveQuizDisplayStatus(
        { status: "GRADED", score: 0, totalPoints: 10 },
        null,
      ),
    ).toEqual({ status: "passed", score: 0 });
  });

  it("passes when score meets passingScore threshold", () => {
    expect(
      deriveQuizDisplayStatus(
        { status: "GRADED", score: 7, totalPoints: 10 },
        70,
      ),
    ).toEqual({ status: "passed", score: 70 });
  });
});
