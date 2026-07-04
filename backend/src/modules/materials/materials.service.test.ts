import { describe, it, expect } from "vitest";
import { toStudentMaterialDTO } from "./materials.service.js";

describe("toStudentMaterialDTO", () => {
  it("marks PDF as previewable and downloadable without exposing storage path", () => {
    const dto = toStudentMaterialDTO(
      {
        id: "mat-1",
        displayName: "ملخص الدرس.pdf",
        fileSize: 1200,
        mimeType: "application/pdf",
      },
      { hasDownloaded: false, firstDownloadedAt: null, lastDownloadedAt: null },
    );

    expect(dto.fileName).toBe("ملخص الدرس.pdf");
    expect(dto.displayName).toBe("ملخص الدرس.pdf");
    expect(dto.canPreview).toBe(true);
    expect(dto.canDownload).toBe(true);
    expect(dto.hasDownloaded).toBe(false);
    expect(dto).not.toHaveProperty("filePath");
    expect(dto).not.toHaveProperty("url");
  });

  it("returns independent status per material id", () => {
    const downloaded = toStudentMaterialDTO(
      { id: "a", displayName: "a.pdf", fileSize: 1, mimeType: "application/pdf" },
      {
        hasDownloaded: true,
        firstDownloadedAt: new Date("2026-01-01"),
        lastDownloadedAt: new Date("2026-01-02"),
      },
    );
    const pending = toStudentMaterialDTO(
      { id: "b", displayName: "b.pdf", fileSize: 1, mimeType: "application/pdf" },
      { hasDownloaded: false, firstDownloadedAt: null, lastDownloadedAt: null },
    );

    expect(downloaded.hasDownloaded).toBe(true);
    expect(pending.hasDownloaded).toBe(false);
  });
});
