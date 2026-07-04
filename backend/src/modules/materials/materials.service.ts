import type { Response } from "express";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { FilesService } from "../files/files.service.js";
import {
  assertStudentMaterialAccess,
  assertTeacherMaterialAccess,
  loadActiveMaterial,
} from "./material-access.service.js";
import {
  getDownloadRecordsForStudents,
  getMaterialDownloadStatuses,
  recordSuccessfulMaterialDownload,
} from "./material-download-tracking.js";
import { buildContentDisposition } from "./material-filename.util.js";
import type {
  StudentMaterialDTO,
  TeacherMaterialDownloadStatusResponse,
} from "./materials.types.js";
const filesService = new FilesService();

const PREVIEWABLE_MIME = new Set(["application/pdf"]);

function isDownloadableMime(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("application/");
}

export function toStudentMaterialDTO(
  material: {
    id: string;
    displayName: string;
    fileSize: number;
    mimeType: string;
  },
  downloadStatus: {
    hasDownloaded: boolean;
    firstDownloadedAt: Date | null;
    lastDownloadedAt: Date | null;
  },
): StudentMaterialDTO {
  const canDownload = isDownloadableMime(material.mimeType);
  return {
    id: material.id,
    displayName: material.displayName,
    fileName: material.displayName,
    mimeType: material.mimeType,
    fileSize: material.fileSize,
    canPreview: canDownload && PREVIEWABLE_MIME.has(material.mimeType),
    canDownload,
    hasDownloaded: downloadStatus.hasDownloaded,
    firstDownloadedAt: downloadStatus.firstDownloadedAt?.toISOString() ?? null,
    lastDownloadedAt: downloadStatus.lastDownloadedAt?.toISOString() ?? null,
  };
}

export async function buildStudentMaterialsForLesson(
  studentId: string,
  materials: Array<{
    id: string;
    displayName: string;
    fileSize: number;
    mimeType: string;
  }>,
): Promise<StudentMaterialDTO[]> {
  if (materials.length === 0) return [];

  const statuses = await getMaterialDownloadStatuses(
    studentId,
    materials.map((m) => m.id),
  );

  return materials.map((m) =>
    toStudentMaterialDTO(m, statuses.get(m.id) ?? {
      hasDownloaded: false,
      firstDownloadedAt: null,
      lastDownloadedAt: null,
    }),
  );
}

async function streamMaterialToResponse(
  res: Response,
  ctx: Awaited<ReturnType<typeof loadActiveMaterial>>,
  disposition: "attachment" | "inline",
  onSuccessfulDelivery?: () => Promise<void>,
): Promise<void> {
  const { buffer, contentType } = await filesService.downloadFileBuffer(
    ctx.material.filePath,
  );

  const mime =
    ctx.material.mimeType && ctx.material.mimeType.length > 0
      ? ctx.material.mimeType
      : contentType;

  res.setHeader("Content-Type", mime);
  res.setHeader(
    "Content-Disposition",
    buildContentDisposition(ctx.material.displayName, disposition),
  );
  if (buffer.length > 0) {
    res.setHeader("Content-Length", String(buffer.length));
  }
  res.setHeader("Cache-Control", "private, no-store");

  let recorded = false;
  const recordOnce = async (): Promise<void> => {
    if (recorded || !onSuccessfulDelivery) return;
    recorded = true;
    await onSuccessfulDelivery();
  };

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void recordOnce();
    }
  });

  res.on("close", () => {
    if (!res.writableFinished) {
      recorded = true;
    }
  });

  res.status(200).send(buffer);
}

export class MaterialsService {
  async downloadForStudent(
    studentId: string,
    materialId: string,
    res: Response,
  ): Promise<void> {
    const ctx = await loadActiveMaterial(materialId);
    await assertStudentMaterialAccess(studentId, ctx);

    if (!isDownloadableMime(ctx.material.mimeType)) {
      throw new AppError("Material is not available for download", 403);
    }

    await streamMaterialToResponse(res, ctx, "attachment", async () => {
      await recordSuccessfulMaterialDownload(studentId, materialId);
    });
  }

  async previewForStudent(
    studentId: string,
    materialId: string,
    res: Response,
  ): Promise<void> {
    const ctx = await loadActiveMaterial(materialId);
    await assertStudentMaterialAccess(studentId, ctx);

    if (!PREVIEWABLE_MIME.has(ctx.material.mimeType)) {
      throw new AppError("Preview is not available for this material", 403);
    }

    await streamMaterialToResponse(res, ctx, "inline");
  }

  async getDownloadStatusesForTeacher(
    teacherId: string,
    materialId: string,
  ): Promise<TeacherMaterialDownloadStatusResponse> {
    const ctx = await loadActiveMaterial(materialId);
    await assertTeacherMaterialAccess(teacherId, ctx);

    const students = await listChapterStudentsForTeacherStatus(
      ctx.chapter.id,
      ctx.chapter.stageId,
      ctx.chapter.price,
    );

    const downloadByStudent = await getDownloadRecordsForStudents(
      materialId,
      students.map((s) => s.studentId),
    );

    const rows = students.map((s) => {
      const dl = downloadByStudent.get(s.studentId)!;
      return {
        studentId: s.studentId,
        studentName: s.studentName,
        hasDownloaded: dl.hasDownloaded,
        firstDownloadedAt: dl.firstDownloadedAt?.toISOString() ?? null,
        lastDownloadedAt: dl.lastDownloadedAt?.toISOString() ?? null,
      };
    });

    const downloadedCount = rows.filter((r) => r.hasDownloaded).length;

    return {
      material: {
        id: ctx.material.id,
        displayName: ctx.material.displayName,
        fileName: ctx.material.displayName,
        lessonId: ctx.lesson.id,
        lessonTitle: ctx.lesson.title,
      },
      summary: {
        enrolledStudentCount: rows.length,
        downloadedCount,
        notDownloadedCount: rows.length - downloadedCount,
      },
      students: rows,
    };
  }
}

async function listChapterStudentsForTeacherStatus(
  chapterId: string,
  stageId: string,
  price: number | null,
): Promise<Array<{ studentId: string; studentName: string }>> {
  if (price === null || price <= 0) {
    const profiles = await prisma.studentProfile.findMany({
      where: {
        stageId,
        user: { role: "STUDENT", status: "ACTIVE" },
      },
      select: {
        userId: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    });
    return profiles.map((p) => ({
      studentId: p.userId,
      studentName: p.user.fullName,
    }));
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { chapterId, status: "ACTIVE" },
    select: {
      studentId: true,
      student: { select: { fullName: true } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return enrollments.map((e) => ({
    studentId: e.studentId,
    studentName: e.student.fullName,
  }));
}

export const materialsService = new MaterialsService();
