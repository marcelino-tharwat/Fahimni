import { describe, it, expect } from "vitest";
import { z } from "zod";
import { adaptZodError, classifyZodIssue } from "./validationCodes.js";

function issuesFor(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected schema to fail");
  return result.error.issues;
}

describe("classifyZodIssue — stable codes derived from Zod issue shape, not message text", () => {
  it("classifies a missing required field as REQUIRED", () => {
    const schema = z.object({ name: z.string() });
    const [issue] = issuesFor(schema, {});
    expect(classifyZodIssue(issue!)).toBe("REQUIRED");
  });

  it("classifies an empty required string (min(1)) as REQUIRED", () => {
    const schema = z.object({ name: z.string().min(1, "Custom hardcoded message") });
    const [issue] = issuesFor(schema, { name: "" });
    expect(classifyZodIssue(issue!)).toBe("REQUIRED");
  });

  it("classifies an invalid email as EMAIL_INVALID regardless of the schema's own message", () => {
    const schema = z.object({ email: z.string().email("Some hardcoded English message") });
    const [issue] = issuesFor(schema, { email: "not-an-email" });
    expect(classifyZodIssue(issue!)).toBe("EMAIL_INVALID");
  });

  it("classifies an invalid enum/choice as INVALID_CHOICE", () => {
    const schema = z.object({ role: z.enum(["STUDENT", "OPERATION"]) });
    const [issue] = issuesFor(schema, { role: "ADMIN" });
    expect(classifyZodIssue(issue!)).toBe("INVALID_CHOICE");
  });

  it("classifies a mobile-like field failing a regex as MOBILE_INVALID", () => {
    const schema = z.object({ mobile: z.string().regex(/^01[0-9]{9}$/) });
    const [issue] = issuesFor(schema, { mobile: "not-a-number" });
    expect(classifyZodIssue(issue!)).toBe("MOBILE_INVALID");
  });

  it("classifies a short password as PASSWORD_MIN", () => {
    const schema = z.object({ password: z.string().min(8) });
    const [issue] = issuesFor(schema, { password: "short" });
    expect(classifyZodIssue(issue!)).toBe("PASSWORD_MIN");
  });

  it("classifies a confirmPassword refine mismatch as PASSWORD_MISMATCH", () => {
    const schema = z
      .object({ password: z.string(), confirmPassword: z.string() })
      .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    const [issue] = issuesFor(schema, { password: "a", confirmPassword: "b" });
    expect(classifyZodIssue(issue!)).toBe("PASSWORD_MISMATCH");
  });

  it("classifies a generic too-short (non-password) field as TOO_SHORT", () => {
    const schema = z.object({ bio: z.string().min(10) });
    const [issue] = issuesFor(schema, { bio: "short" });
    expect(classifyZodIssue(issue!)).toBe("TOO_SHORT");
  });

  it("classifies an invalid uuid as INVALID_ID", () => {
    const schema = z.object({ id: z.string().uuid() });
    const [issue] = issuesFor(schema, { id: "not-a-uuid" });
    expect(classifyZodIssue(issue!)).toBe("INVALID_ID");
  });
});

describe("adaptZodError — full response shape + locale-aware fallback messages", () => {
  const schema = z.object({
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "Required"),
  });

  it("produces a stable top-level VALIDATION_ERROR code and a per-field errors array", () => {
    const result = schema.safeParse({ email: "bad", name: "" });
    if (result.success) throw new Error("expected failure");

    const adapted = adaptZodError(result.error, "en");
    expect(adapted.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(adapted.errors)).toBe(true);
    expect(adapted.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email", code: "EMAIL_INVALID" }),
        expect.objectContaining({ field: "name", code: "REQUIRED" }),
      ]),
    );
  });

  it("uses English fallback messages for locale 'en'", () => {
    const result = schema.safeParse({ email: "bad", name: "x" });
    if (result.success) throw new Error("expected failure");
    const adapted = adaptZodError(result.error, "en");
    expect(adapted.message).toBe("Validation error");
    const emailError = adapted.errors.find((e) => e.field === "email");
    expect(emailError?.message).toBe("Invalid email address");
  });

  it("uses Arabic fallback messages for locale 'ar', never mixing languages", () => {
    const result = schema.safeParse({ email: "bad", name: "x" });
    if (result.success) throw new Error("expected failure");
    const adapted = adaptZodError(result.error, "ar");
    expect(adapted.message).toBe("بيانات غير صالحة");
    const emailError = adapted.errors.find((e) => e.field === "email");
    expect(emailError?.message).toBe("البريد الإلكتروني غير صالح");
    // No Latin-script leakage into the Arabic-locale fallback message.
    expect(emailError?.message).not.toMatch(/[a-zA-Z]/);
  });
});
