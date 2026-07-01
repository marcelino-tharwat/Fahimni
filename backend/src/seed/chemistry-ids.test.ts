import { describe, it, expect } from "vitest";
import {
  assertValidSeedUuid,
  isValidUuid,
  seedId,
} from "./chemistry-ids.js";

describe("chemistry seedId", () => {
  it("produces valid UUIDs", () => {
    const id = seedId("quiz-ch2-question-01");
    expect(isValidUuid(id)).toBe(true);
    assertValidSeedUuid(id, "quiz-ch2-question-01");
  });

  it("is stable for the same key", () => {
    expect(seedId("teacher")).toBe(seedId("teacher"));
  });

  it("differs across keys", () => {
    expect(seedId("quiz-ch1-question-01")).not.toBe(
      seedId("quiz-ch2-question-01"),
    );
  });

  it("never produces legacy seed-chem prefixes", () => {
    expect(seedId("admin")).not.toMatch(/^seed-chem-/);
  });
});
