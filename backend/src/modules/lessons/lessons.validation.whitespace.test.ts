import { describe, it, expect } from "vitest";
import { createLessonSchema } from "./lessons.validation.js";

const baseLesson = {
  durationMinutes: 10,
  sortOrder: 1,
};

describe("createLessonSchema — whitespace/tab normalization", () => {
  it("4. title = spaces-only is rejected", () => {
    const result = createLessonSchema.safeParse({ ...baseLesson, title: "     " });
    expect(result.success).toBe(false);
  });

  it("title = tab-only is rejected", () => {
    const result = createLessonSchema.safeParse({ ...baseLesson, title: "\t" });
    expect(result.success).toBe(false);
  });

  it("9. saved title is trimmed", () => {
    const result = createLessonSchema.safeParse({ ...baseLesson, title: "\nIntroduction\t" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Introduction");
  });
});
