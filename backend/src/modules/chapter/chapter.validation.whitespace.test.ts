import { describe, it, expect } from "vitest";
import { createChapterSchema } from "./chapter.validation.js";

const baseChapter = {
  name: "Atomic Structure",
  sortOrder: 1,
  term: "FIRST_TERM" as const,
};

describe("createChapterSchema — whitespace/tab normalization", () => {
  it("4. name = spaces-only is rejected", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, name: "     " });
    expect(result.success).toBe(false);
  });

  it("name = tab-only is rejected", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, name: "\t" });
    expect(result.success).toBe(false);
  });

  it("9. saved name is trimmed", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, name: "  Atomic Structure  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Atomic Structure");
  });

  it("subject = spaces-only normalizes to no subject (optional field), not saved as blank", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, subject: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBeUndefined();
  });

  it("subject with surrounding whitespace is trimmed when provided", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, subject: "  الكيمياء  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe("الكيمياء");
  });

  it("description with surrounding whitespace is trimmed when provided", () => {
    const result = createChapterSchema.safeParse({ ...baseChapter, description: "  Intro to atoms  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("Intro to atoms");
  });
});
