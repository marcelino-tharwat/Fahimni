import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression tests for the bug found while diagnosing a manually-registered
// teacher account (ali@gmail.com) getting a 403 EMAIL_NOT_VERIFIED on login
// forever: registerTeacherPending used to set emailVerified:false for
// self-registered teachers, and loginUser's email-verification gate applies
// to every non-ADMIN role — so a pending/approved/rejected teacher could
// never log in at all, even in the intended restricted "pending review" mode.

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  teacherRegistrationRequest: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  teacherProfile: { create: vi.fn() },
  studentProfile: { create: vi.fn() },
  otp: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

const mockSendTransactionalEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../email/transactional-email.helpers.js", () => ({
  sendTransactionalEmail: mockSendTransactionalEmail,
  normalizeLocale: (l: string) => l,
}));

vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { AuthService } from "./auth.service.js";
import { AdminUsersService } from "../admin/admin-users.service.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.validation.js";

const authService = new AuthService();

const baseTeacherInput: RegisterInput = {
  fullName: "Test Teacher",
  mobile: "01012345678",
  email: "teacher@example.com",
  password: "Str0ng!Pass",
  role: "OPERATION",
  locale: "ar",
} as RegisterInput;

const baseStudentInput: RegisterInput = {
  fullName: "Test Student",
  mobile: "01012345679",
  email: "student@example.com",
  password: "Str0ng!Pass",
  role: "STUDENT",
  stageId: "11111111-1111-4111-8111-111111111111",
  locale: "ar",
} as RegisterInput;

function mockTransaction() {
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction();
  mockPrisma.user.findUnique.mockResolvedValue(null); // no duplicate mobile/email
  mockPrisma.teacherRegistrationRequest.findFirst.mockResolvedValue(null); // no dup pending request
  mockPrisma.teacherRegistrationRequest.findUnique.mockResolvedValue(null); // publicReference is free
  mockPrisma.otp.create.mockResolvedValue({ id: "otp-1" });
});

describe("AuthService.registerUser — teacher self-registration (root-cause fix)", () => {
  it("1 & 2. creates the teacher with emailVerified:true and teacherApprovalState:PENDING_REVIEW", async () => {
    mockPrisma.user.create.mockResolvedValue({ id: "teacher-1", email: baseTeacherInput.email });
    mockPrisma.teacherRegistrationRequest.create.mockResolvedValue({ id: "req-1" });

    await authService.registerUser(baseTeacherInput);

    const createArg = mockPrisma.user.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createArg.data.emailVerified).toBe(true);
    expect(createArg.data.teacherApprovalState).toBe("PENDING_REVIEW");
    expect(createArg.data.status).toBe("INACTIVE");
  });

  it("3. does NOT enqueue an email-verification message — only the registration-submitted notification", async () => {
    mockPrisma.user.create.mockResolvedValue({ id: "teacher-1", email: baseTeacherInput.email });
    mockPrisma.teacherRegistrationRequest.create.mockResolvedValue({ id: "req-1" });

    await authService.registerUser(baseTeacherInput);

    const templates = mockSendTransactionalEmail.mock.calls.map((c) => (c[0] as { template: string }).template);
    expect(templates).not.toContain("emailVerification");
    expect(templates).toContain("teacherRegistrationSubmitted");
    expect(mockSendTransactionalEmail).toHaveBeenCalledTimes(1);
  });
});

describe("AuthService.registerUser — student self-registration (unchanged)", () => {
  it("student registration still sets emailVerified:false and enqueues a verification email", async () => {
    mockPrisma.user.create.mockResolvedValue({ id: "student-1", email: baseStudentInput.email });

    await authService.registerUser(baseStudentInput);

    const createArg = mockPrisma.user.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createArg.data.emailVerified).toBe(false);
    const templates = mockSendTransactionalEmail.mock.calls.map((c) => (c[0] as { template: string }).template);
    expect(templates).toContain("emailVerification");
  });
});

const password = "Str0ng!Pass";
let hashedPassword: string;

describe("AuthService.loginUser — per-role gating", () => {
  beforeEach(async () => {
    if (!hashedPassword) {
      const bcrypt = (await import("bcryptjs")).default;
      hashedPassword = await bcrypt.hash(password, 4);
    }
  });

  function userRow(overrides: Record<string, unknown>) {
    return {
      id: "u1",
      email: "u@example.com",
      password: hashedPassword,
      role: "STUDENT",
      status: "ACTIVE",
      teacherApprovalState: "NONE",
      emailVerified: true,
      tokenVersion: 0,
      ...overrides,
    };
  }

  it("4. unverified student is blocked with 403 EMAIL_NOT_VERIFIED", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow({ emailVerified: false }));

    await expect(
      authService.loginUser({ email: "u@example.com", password } as LoginInput),
    ).rejects.toMatchObject({ statusCode: 403, code: "EMAIL_NOT_VERIFIED" });
  });

  it("5. a pending teacher (emailVerified:true) logs in successfully in restricted mode — never EMAIL_NOT_VERIFIED", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      userRow({ role: "OPERATION", status: "INACTIVE", teacherApprovalState: "PENDING_REVIEW", emailVerified: true }),
    );
    mockPrisma.user.update = vi.fn().mockResolvedValue({ tokenVersion: 1 });
    mockPrisma.refreshToken = { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) } as never;

    const result = await authService.loginUser({ email: "u@example.com", password } as LoginInput);
    expect(result.accessState).toBe("TEACHER_PENDING_REVIEW");
  });

  it("6. an approved teacher logs in normally (200-equivalent, resolves)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      userRow({ role: "OPERATION", status: "ACTIVE", teacherApprovalState: "APPROVED", emailVerified: true }),
    );
    mockPrisma.user.update = vi.fn().mockResolvedValue({ tokenVersion: 1 });
    mockPrisma.refreshToken = { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) } as never;
    mockPrisma.teacherSubscription = { findFirst: vi.fn().mockResolvedValue(null) } as never;

    const result = await authService.loginUser({ email: "u@example.com", password } as LoginInput);
    expect(result.accessState).toBe("FREE_TEACHER");
  });

  it("7. a verified student logs in normally", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow({ emailVerified: true }));
    mockPrisma.user.update = vi.fn().mockResolvedValue({ tokenVersion: 1 });
    mockPrisma.refreshToken = { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) } as never;

    const result = await authService.loginUser({ email: "u@example.com", password } as LoginInput);
    expect(result.user.role).toBe("STUDENT");
  });

  it("8. an admin logs in even with emailVerified:false in the DB (role-based exemption, untouched)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow({ role: "ADMIN", emailVerified: false }));
    mockPrisma.user.update = vi.fn().mockResolvedValue({ tokenVersion: 1 });
    mockPrisma.refreshToken = { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) } as never;

    const result = await authService.loginUser({ email: "u@example.com", password } as LoginInput);
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("registerSchema — client cannot pick role:ADMIN", () => {
  it("10. rejects role:ADMIN (only STUDENT/OPERATION are valid choices)", async () => {
    const { registerSchema } = await import("./auth.validation.js");
    const result = registerSchema.safeParse({
      fullName: "Fake Admin",
      mobile: "01012345670",
      email: "fake-admin@example.com",
      password: "Str0ng!Pass",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
  });
});

describe("AppError sanity", () => {
  it("EMAIL_NOT_VERIFIED is a real AppError instance with the documented shape", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", email: "u@example.com", password: hashedPassword,
      role: "STUDENT", status: "ACTIVE", teacherApprovalState: "NONE", emailVerified: false,
    });
    try {
      await authService.loginUser({ email: "u@example.com", password: "Str0ng!Pass" } as LoginInput);
      expect.unreachable("expected loginUser to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });
});

describe("AdminUsersService.createUser — 9. admin-created teacher is immediately loginable (unchanged)", () => {
  it("always sets emailVerified:true regardless of role", async () => {
    const adminUsersService = new AdminUsersService();
    mockPrisma.user.findFirst = vi.fn().mockResolvedValue(null); // no duplicate
    mockPrisma.user.create.mockResolvedValue({
      id: "teacher-2", fullName: "Admin-Created Teacher", email: "admincreated@example.com",
      mobile: "01012345680", role: "OPERATION", status: "ACTIVE", teacherApprovalState: "APPROVED",
      createdAt: new Date(), updatedAt: new Date(),
    });

    await adminUsersService.createUser(
      {
        fullName: "Admin-Created Teacher",
        email: "admincreated@example.com",
        mobile: "01012345680",
        password: "Str0ng!Pass",
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
      } as never,
      "admin-1",
    );

    const createArg = mockPrisma.user.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createArg.data.emailVerified).toBe(true);
  });
});
