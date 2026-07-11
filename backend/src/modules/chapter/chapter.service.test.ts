import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterService } from "./chapter.service.js";

const mockPrisma = vi.hoisted(() => ({
  stage: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  chapter: { create: vi.fn(), count: vi.fn() },
}));

vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn() },
}));
vi.mock("../../shared/upload.service.js", () => ({
  UploadService: vi.fn(),
}));
vi.mock("../files/files.service.js", () => ({
  FilesService: vi.fn(() => ({ deleteFile: vi.fn() })),
}));

describe("ChapterService subject ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.stage.findFirst.mockResolvedValue({ id: "stage-1" });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "teacher-1",
      teacherProfile: { subject: "الفيزياء" },
    });
    mockPrisma.chapter.create.mockResolvedValue({
      id: "chapter-1",
      name: "Physics",
      description: null,
      sortOrder: 1,
      price: null,
      imageUrl: null,
      teacherId: "teacher-1",
      stageId: "stage-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("rejects a chapter subject different from the teacher profile subject", async () => {
    const service = new ChapterService();

    await expect(
      service.create(
        {
          name: "Arabic chapter",
          sortOrder: 1,
          price: null,
          description: null,
          subject: "اللغة العربية",
        },
        "stage-1",
        "teacher-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TEACHER_SUBJECT_MISMATCH",
    });
    expect(mockPrisma.chapter.create).not.toHaveBeenCalled();
  });

  it("allows matching subject and derives ownership from chapter teacherId", async () => {
    const service = new ChapterService();

    const chapter = await service.create(
      {
        name: "Physics chapter",
        sortOrder: 1,
        price: null,
        description: null,
        subject: "الفيزياء",
      },
      "stage-1",
      "teacher-1",
    );

    expect(chapter.id).toBe("chapter-1");
    expect(mockPrisma.chapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teacherId: "teacher-1", stageId: "stage-1" }),
      }),
    );
  });
});
