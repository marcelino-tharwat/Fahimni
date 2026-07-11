import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure unit test: replace the Prisma singleton so registerUser's duplicate
// mobile/email checks can be exercised without a database.
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { AuthService } from "./auth.service.js";
import { AppError } from "../../shared/utils/AppError.js";
import { registerSchema, type RegisterInput } from "./auth.validation.js";

const authService = new AuthService();

const baseInput: RegisterInput = {
  fullName: "Test Student",
  mobile: "01012345678",
  email: "student@example.com",
  password: "Str0ng!Pass",
  role: "STUDENT",
  stageId: "stage-1",
  locale: "ar",
} as RegisterInput;

describe("AuthService.registerUser — duplicate detection", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockClear();
  });

  it("rejects a duplicate mobile number with a stable DUPLICATE_MOBILE code", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing-user" });

    await expect(authService.registerUser(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_MOBILE",
    });
  });

  it("rejects a duplicate email with a stable DUPLICATE_EMAIL code", async () => {
    // First call (mobile check) finds nothing; second call (email check) finds a match.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-user" });

    await expect(authService.registerUser(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_EMAIL",
    });
  });

  it("both duplicate errors are thrown as AppError instances (not raw Error)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing-user" });
    try {
      await authService.registerUser(baseInput);
      expect.unreachable("expected registerUser to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });

  it("10. duplicate email check works after trim — a raw email with surrounding whitespace/casing normalizes through registerSchema before the duplicate lookup", async () => {
    // Simulate the real request pipeline: the raw (whitespace/casing-messy)
    // client input is first normalized by the Zod schema, exactly as
    // validateRequest() would do before the service ever sees it.
    const parsed = registerSchema.safeParse({
      ...baseInput,
      email: "  Student@Example.com\t",
      stageId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // mobile check
      .mockResolvedValueOnce({ id: "existing-user" }); // email check

    await expect(authService.registerUser(parsed.data)).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_EMAIL",
    });

    // The lookup must use the normalized (trimmed + lowercased) email, not
    // the raw client-supplied string.
    const emailLookupCall = mockPrisma.user.findUnique.mock.calls[1]![0];
    expect(emailLookupCall).toMatchObject({ where: { email: "student@example.com" } });
  });
});
