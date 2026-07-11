import { describe, it, expect } from "vitest";
import { rejectRequestSchema, approveRequestSchema } from "./admin-teacher-requests.validation.js";

describe("rejectRequestSchema — whitespace/tab normalization", () => {
  it("3. adminNotes = newline/tab only is rejected", () => {
    const result = rejectRequestSchema.safeParse({ adminNotes: "\n\t" });
    expect(result.success).toBe(false);
  });

  it("adminNotes = spaces-only is rejected", () => {
    const result = rejectRequestSchema.safeParse({ adminNotes: "     " });
    expect(result.success).toBe(false);
  });

  it("9. saved adminNotes are trimmed", () => {
    const result = rejectRequestSchema.safeParse({ adminNotes: "  Missing documents  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.adminNotes).toBe("Missing documents");
  });
});

describe("approveRequestSchema — whitespace/tab normalization (optional adminNotes)", () => {
  it("adminNotes = whitespace-only normalizes to no notes, not saved as blank", () => {
    const result = approveRequestSchema.safeParse({ adminNotes: "\t\t" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.adminNotes).toBeUndefined();
  });
});
