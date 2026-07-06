import { describe, it, expect, vi, beforeEach } from "vitest";

const mockData = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  userFindFirst: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../config/database.js", () => ({
  prisma: {
    teacherRegistrationRequest: {
      findFirst: mockData.findFirst,
      create: mockData.create,
      update: mockData.update,
      delete: mockData.delete,
    },
    user: {
      findFirst: mockData.userFindFirst,
    },
  },
}));

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockData.upload,
        remove: mockData.remove,
      })),
    },
  },
}));

vi.mock("../../config/logger.js", () => ({
  logger: { warn: vi.fn() },
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "mocked-uuid") }));

import { TeacherRequestService } from "./teacher-request.service.js";

const service = new TeacherRequestService();

function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: "proofDocuments",
    originalname: "certificate.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 1024,
    buffer: Buffer.from("content"),
    destination: "",
    filename: "",
    path: "",
    ...overrides,
  } as Express.Multer.File;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeacherRequestService.create", () => {
  const validInput = {
    fullName: "Mohamed Ahmed",
    email: "m.ahmed@example.com",
    mobile: "01012345678",
    subject: "Mathematics",
    bio: "Experienced teacher",
  };

  const mockPending = {
    id: "req-1",
    publicReference: "TR-2026-100001",
    status: "PENDING",
    createdAt: new Date("2026-07-05T12:00:00Z"),
  };

  it("creates a PENDING request successfully", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: null });
    mockData.update.mockResolvedValue(mockPending);

    const result = await service.create(validInput, [mockFile()]);

    expect(result.status).toBe("PENDING");
    expect(result.publicReference).toBe("TR-2026-100001");
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("creates request with status PENDING always", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: null });
    mockData.update.mockResolvedValue(mockPending);

    await service.create(validInput, [mockFile()]);

    expect(mockData.create).toHaveBeenCalledOnce();
    const createArgs = mockData.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("PENDING");
  });

  it("rejects duplicate PENDING request with same email", async () => {
    mockData.findFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(service.create(validInput, [mockFile()])).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_PENDING_REQUEST",
    });
  });

  it("rejects duplicate PENDING request with same mobile", async () => {
    mockData.findFirst.mockResolvedValueOnce(null);
    mockData.findFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(service.create(validInput, [mockFile()])).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_PENDING_REQUEST",
    });
  });

  it("rejects when OPERATION user exists with same email/mobile", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue({ id: "op-user" });

    await expect(service.create(validInput, [mockFile()])).rejects.toMatchObject({
      statusCode: 409,
      code: "EXISTING_OPERATION_USER",
    });
  });

  it("public response does not contain storageKey or filePath", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: null });
    mockData.update.mockResolvedValue(mockPending);

    const result = await service.create(validInput, [mockFile()]);

    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["publicReference", "status", "createdAt"]),
    );
    expect(Object.keys(result)).not.toContain("storageKey");
    expect(Object.keys(result)).not.toContain("filePath");
    expect(Object.keys(result)).not.toContain("adminNotes");
  });

  it("stores proof document metadata after successful upload", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: null });
    mockData.update.mockResolvedValue(mockPending);

    await service.create(validInput, [mockFile({ originalname: "cert.pdf", size: 2048 })]);

    expect(mockData.update).toHaveBeenCalledOnce();
    const updateArgs = mockData.update.mock.calls[0][0];
    expect(updateArgs.data.proofDocuments).toBeDefined();
    expect(Array.isArray(updateArgs.data.proofDocuments)).toBe(true);
  });

  it("handles upload failure and cleans up request record", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: new Error("Upload failed") });
    mockData.delete.mockResolvedValue(mockPending);

    await expect(service.create(validInput, [mockFile()])).rejects.toThrow();
    expect(mockData.delete).toHaveBeenCalledOnce();
  });

  it("does not accept admin fields from input", async () => {
    mockData.findFirst.mockResolvedValue(null);
    mockData.userFindFirst.mockResolvedValue(null);
    mockData.create.mockResolvedValue(mockPending);
    mockData.upload.mockResolvedValue({ error: null });
    mockData.update.mockResolvedValue(mockPending);

    await service.create(
      { ...validInput, adminNotes: "approve" } as typeof validInput,
      [mockFile()],
    );

    const createArgs = mockData.create.mock.calls[0][0];
    expect(createArgs.data.adminNotes).toBeUndefined();
    expect(createArgs.data.reviewedById).toBeUndefined();
    expect(createArgs.data.reviewedAt).toBeUndefined();
  });
});
