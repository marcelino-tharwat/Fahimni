import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  lessonMaterialDownload: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("../../config/database.js", () => ({
  prisma: mockPrisma,
}));

describe("material-download-tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasDownloaded true for materials with records", async () => {
    const { getMaterialDownloadStatuses } = await import(
      "./material-download-tracking.js"
    );
    const first = new Date("2026-01-01T10:00:00Z");
    const last = new Date("2026-01-02T10:00:00Z");
    mockPrisma.lessonMaterialDownload.findMany.mockResolvedValue([
      {
        materialId: "mat-a",
        firstDownloadedAt: first,
        lastDownloadedAt: last,
      },
    ]);

    const map = await getMaterialDownloadStatuses("student-1", ["mat-a", "mat-b"]);
    expect(map.get("mat-a")).toEqual({
      hasDownloaded: true,
      firstDownloadedAt: first,
      lastDownloadedAt: last,
    });
    expect(map.get("mat-b")?.hasDownloaded).toBe(false);
  });

  it("upserts download without duplicating on repeat", async () => {
    const { recordSuccessfulMaterialDownload } = await import(
      "./material-download-tracking.js"
    );
    mockPrisma.lessonMaterialDownload.upsert.mockResolvedValue({});

    await recordSuccessfulMaterialDownload("student-1", "mat-a");

    expect(mockPrisma.lessonMaterialDownload.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_materialId: { studentId: "student-1", materialId: "mat-a" } },
        update: expect.objectContaining({ lastDownloadedAt: expect.any(Date) }),
        create: expect.objectContaining({
          studentId: "student-1",
          materialId: "mat-a",
        }),
      }),
    );
  });
});
