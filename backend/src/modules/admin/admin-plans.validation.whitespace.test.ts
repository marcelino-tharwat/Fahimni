import { describe, it, expect } from "vitest";
import { createPlanSchema, statusChangeSchema } from "./admin-plans.validation.js";

const basePlan = {
  code: "BASIC",
  name: "Basic Plan",
  displayName: "Basic",
};

describe("createPlanSchema — whitespace/tab normalization", () => {
  it("2. name = spaces-only is rejected", () => {
    const result = createPlanSchema.safeParse({ ...basePlan, name: "     " });
    expect(result.success).toBe(false);
  });

  it("displayName = tab-only is rejected", () => {
    const result = createPlanSchema.safeParse({ ...basePlan, displayName: "\t" });
    expect(result.success).toBe(false);
  });

  it("9. saved name/displayName are trimmed", () => {
    const result = createPlanSchema.safeParse({
      ...basePlan,
      name: "  Basic Plan  ",
      displayName: "\nBasic\t",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Basic Plan");
      expect(result.data.displayName).toBe("Basic");
    }
  });

  it("code with surrounding whitespace is trimmed and accepted", () => {
    const result = createPlanSchema.safeParse({ ...basePlan, code: "  BASIC  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("BASIC");
  });
});

describe("statusChangeSchema — whitespace/tab normalization", () => {
  it("reason = newline/tab-only is rejected when provided", () => {
    const result = statusChangeSchema.safeParse({ isActive: false, reason: "\n\t" });
    expect(result.success).toBe(false);
  });

  it("reason is trimmed when provided", () => {
    const result = statusChangeSchema.safeParse({ isActive: false, reason: "  Pricing update  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("Pricing update");
  });
});
