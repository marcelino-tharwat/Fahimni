import { describe, it, expect } from "vitest";
import { createTeacherRequestSchema } from "./teacher-request.validation.js";

describe("createTeacherRequestSchema", () => {
  it("accepts valid input with all required fields", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "محمد أحمد",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with optional fields", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "+201012345678",
      subject: "Mathematics",
      bio: "Experienced math teacher",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fullName", () => {
    const result = createTeacherRequestSchema.safeParse({
      email: "m.ahmed@example.com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short fullName", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "A",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "not-an-email",
      mobile: "01012345678",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "M.Ahmed@Example.Com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("m.ahmed@example.com");
    }
  });

  it("rejects invalid Egyptian mobile (no valid prefix)", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01912345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects too short mobile", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "010123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid subject", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      subject: "Arabic Language",
    });
    expect(result.success).toBe(true);
  });

  it("rejects subject exceeding 200 characters", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      subject: "X".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects bio exceeding 1000 characters", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      bio: "X".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("strips whitespace from fullName", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "  Mohamed Ahmed  ",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Mohamed Ahmed");
    }
  });

  it("accepts optional fields as undefined when omitted", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toBeUndefined();
      expect(result.data.bio).toBeUndefined();
    }
  });

  it("does not accept status field from input", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      status: "APPROVED",
    });
    expect(result.success).toBe(true);
    if (result.success && "status" in result.data) {
      expect((result.data as Record<string, unknown>).status).toBeUndefined();
    }
  });

  it("does not accept adminNotes field from input", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      adminNotes: "approve this",
    });
    expect(result.success).toBe(true);
  });

  it("does not accept reviewedBy field from input", () => {
    const result = createTeacherRequestSchema.safeParse({
      fullName: "Mohamed Ahmed",
      email: "m.ahmed@example.com",
      mobile: "01012345678",
      reviewedBy: "admin-id",
    });
    expect(result.success).toBe(true);
  });
});
