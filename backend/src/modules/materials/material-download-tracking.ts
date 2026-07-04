import { prisma } from "../../config/database.js";

export interface MaterialDownloadRecord {
  hasDownloaded: boolean;
  firstDownloadedAt: Date | null;
  lastDownloadedAt: Date | null;
}

export function isMaterialDownloadTrackingEnabled(): boolean {
  return true;
}

export async function getMaterialDownloadStatuses(
  studentId: string,
  materialIds: string[],
): Promise<Map<string, MaterialDownloadRecord>> {
  const map = new Map<string, MaterialDownloadRecord>();
  for (const id of materialIds) {
    map.set(id, {
      hasDownloaded: false,
      firstDownloadedAt: null,
      lastDownloadedAt: null,
    });
  }

  if (materialIds.length === 0) return map;

  const rows = await prisma.lessonMaterialDownload.findMany({
    where: { studentId, materialId: { in: materialIds } },
    select: {
      materialId: true,
      firstDownloadedAt: true,
      lastDownloadedAt: true,
    },
  });

  for (const row of rows) {
    map.set(row.materialId, {
      hasDownloaded: true,
      firstDownloadedAt: row.firstDownloadedAt,
      lastDownloadedAt: row.lastDownloadedAt,
    });
  }

  return map;
}

export async function recordSuccessfulMaterialDownload(
  studentId: string,
  materialId: string,
): Promise<void> {
  const now = new Date();
  await prisma.lessonMaterialDownload.upsert({
    where: {
      studentId_materialId: { studentId, materialId },
    },
    create: {
      studentId,
      materialId,
      firstDownloadedAt: now,
      lastDownloadedAt: now,
    },
    update: {
      lastDownloadedAt: now,
    },
  });
}

export async function getDownloadRecordsForStudents(
  materialId: string,
  studentIds: string[],
): Promise<Map<string, MaterialDownloadRecord>> {
  const map = new Map<string, MaterialDownloadRecord>();
  for (const id of studentIds) {
    map.set(id, {
      hasDownloaded: false,
      firstDownloadedAt: null,
      lastDownloadedAt: null,
    });
  }

  if (studentIds.length === 0) return map;

  const rows = await prisma.lessonMaterialDownload.findMany({
    where: { materialId, studentId: { in: studentIds } },
    select: {
      studentId: true,
      firstDownloadedAt: true,
      lastDownloadedAt: true,
    },
  });

  for (const row of rows) {
    map.set(row.studentId, {
      hasDownloaded: true,
      firstDownloadedAt: row.firstDownloadedAt,
      lastDownloadedAt: row.lastDownloadedAt,
    });
  }

  return map;
}
