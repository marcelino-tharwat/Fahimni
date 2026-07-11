import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, changePasswordSchema } from "./auth.validation.js";

const baseRegister = {
  fullName: "Ahmed Ali",
  mobile: "01012345678",
  email: "student@example.com",
  password: "Str0ng!Pass",
  role: "STUDENT" as const,
  stageId: "11111111-1111-4111-8111-111111111111",
};

describe("registerSchema — whitespace/tab normalization", () => {
  it("1. fullName = tab-only is rejected", () => {
    const result = registerSchema.safeParse({ ...baseRegister, fullName: "\t" });
    expect(result.success).toBe(false);
  });

  it("fullName = newline+tab-only is rejected", () => {
    const result = registerSchema.safeParse({ ...baseRegister, fullName: "\n\t" });
    expect(result.success).toBe(false);
  });

  it("5. email with surrounding whitespace is trimmed and accepted", () => {
    const result = registerSchema.safeParse({ ...baseRegister, email: "  user@example.com\t" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });

  it("6. email whitespace-only is rejected", () => {
    const result = registerSchema.safeParse({ ...baseRegister, email: "   " });
    expect(result.success).toBe(false);
  });

  it("9. saved fullName is trimmed", () => {
    const result = registerSchema.safeParse({ ...baseRegister, fullName: "   Ahmed   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Ahmed");
  });

  it("mobile with surrounding whitespace is trimmed and accepted (internal digits untouched)", () => {
    const result = registerSchema.safeParse({ ...baseRegister, mobile: "  01012345678\t" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mobile).toBe("01012345678");
  });

  it("bio = whitespace-only normalizes to no bio (optional field), not saved as blank", () => {
    const result = registerSchema.safeParse({ ...baseRegister, bio: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bio).toBeUndefined();
  });
});

describe("loginSchema / changePasswordSchema — password whitespace handling", () => {
  it("7. password whitespace-only is rejected (login)", () => {
    const result = loginSchema.safeParse({ email: "student@example.com", password: "        " });
    expect(result.success).toBe(false);
  });

  it("password whitespace-only is rejected (currentPassword on change-password)", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "\t\t\t\t\t\t\t\t",
      newPassword: "Str0ng!Pass",
    });
    expect(result.success).toBe(false);
  });

  it("8. a password with internal content plus leading/trailing whitespace is accepted verbatim (never silently trimmed)", () => {
    // Documented policy: passwords are never `.trim()`-ed — whitespace around
    // otherwise-valid content is treated as part of the password itself.
    const result = registerSchema.safeParse({ ...baseRegister, password: "  Str0ng!Pass  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe("  Str0ng!Pass  ");
  });

  it("a whitespace-only registration password is rejected (fails the character-class requirements)", () => {
    const result = registerSchema.safeParse({ ...baseRegister, password: "        " });
    expect(result.success).toBe(false);
  });

  it("empty password is rejected", () => {
    const result = loginSchema.safeParse({ email: "student@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
