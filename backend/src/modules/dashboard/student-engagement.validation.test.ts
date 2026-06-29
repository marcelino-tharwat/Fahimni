import { describe, it, expect } from "vitest";
import {
  studentEngagementQuerySchema,
  MAX_SEARCH_LENGTH,
} from "./student-engagement.validation.js";

function parse(input: unknown) {
  return studentEngagementQuerySchema.safeParse(input);
}

describe("studentEngagementQuerySchema", () => {
  it("defaults page to 1 and limit to 20", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(20);
      expect(r.data.sortBy).toBe("name");
      expect(r.data.sortOrder).toBe("asc");
    }
  });

  it("coerces numeric strings from the query", () => {
    const r = parse({ page: "3", limit: "10" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.limit).toBe(10);
    }
  });

  it("rejects a non-positive or non-integer page", () => {
    expect(parse({ page: "0" }).success).toBe(false);
    expect(parse({ page: "-1" }).success).toBe(false);
    expect(parse({ page: "1.5" }).success).toBe(false);
  });

  it("caps limit at the safe maximum", () => {
    expect(parse({ limit: "101" }).success).toBe(false);
  });

  it("trims the search term", () => {
    const r = parse({ search: "  أحمد  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.search).toBe("أحمد");
  });

  it("rejects an excessively long search term", () => {
    expect(parse({ search: "x".repeat(MAX_SEARCH_LENGTH + 1) }).success).toBe(false);
  });

  it("accepts the three supported sort fields", () => {
    for (const sortBy of ["name", "lastActivity", "averageQuizScore"]) {
      expect(parse({ sortBy }).success).toBe(true);
    }
  });

  it("rejects an unsupported sort field", () => {
    expect(parse({ sortBy: "studentPhone" }).success).toBe(false);
  });

  it("accepts asc and desc but rejects other directions", () => {
    expect(parse({ sortOrder: "asc" }).success).toBe(true);
    expect(parse({ sortOrder: "desc" }).success).toBe(true);
    expect(parse({ sortOrder: "sideways" }).success).toBe(false);
  });

  it("strips unknown query fields", () => {
    const r = parse({ teacherId: "evil", foo: "bar" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("teacherId");
      expect(r.data).not.toHaveProperty("foo");
    }
  });
});
